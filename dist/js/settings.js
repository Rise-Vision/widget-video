/*!
 * angular-translate - v2.5.2 - 2014-12-10
 * http://github.com/angular-translate/angular-translate
 * Copyright (c) 2014 ; Licensed MIT
 */
/**
 * @ngdoc overview
 * @name pascalprecht.translate
 *
 * @description
 * The main module which holds everything together.
 */
angular.module('pascalprecht.translate', ['ng'])

.run(['$translate', function ($translate) {

  var key = $translate.storageKey(),
      storage = $translate.storage();

  var fallbackFromIncorrectStorageValue = function() {
    var preferred = $translate.preferredLanguage();
    if (angular.isString(preferred)) {
      $translate.use(preferred);
      // $translate.use() will also remember the language.
      // So, we don't need to call storage.put() here.
    } else {
      storage.put(key, $translate.use());
    }
  };

  if (storage) {
    if (!storage.get(key)) {
      fallbackFromIncorrectStorageValue();
    } else {
      $translate.use(storage.get(key))['catch'](fallbackFromIncorrectStorageValue);
    }
  } else if (angular.isString($translate.preferredLanguage())) {
    $translate.use($translate.preferredLanguage());
  }
}]);

/**
 * @ngdoc object
 * @name pascalprecht.translate.$translateProvider
 * @description
 *
 * $translateProvider allows developers to register translation-tables, asynchronous loaders
 * and similar to configure translation behavior directly inside of a module.
 *
 */
angular.module('pascalprecht.translate').provider('$translate', ['$STORAGE_KEY', function ($STORAGE_KEY) {

  var $translationTable = {},
      $preferredLanguage,
      $availableLanguageKeys = [],
      $languageKeyAliases,
      $fallbackLanguage,
      $fallbackWasString,
      $uses,
      $nextLang,
      $storageFactory,
      $storageKey = $STORAGE_KEY,
      $storagePrefix,
      $missingTranslationHandlerFactory,
      $interpolationFactory,
      $interpolatorFactories = [],
      $interpolationSanitizationStrategy = false,
      $loaderFactory,
      $cloakClassName = 'translate-cloak',
      $loaderOptions,
      $notFoundIndicatorLeft,
      $notFoundIndicatorRight,
      $postCompilingEnabled = false,
      NESTED_OBJECT_DELIMITER = '.',
      loaderCache;

  var version = '2.5.2';

  // tries to determine the browsers language
  var getFirstBrowserLanguage = function () {
    var nav = window.navigator,
        browserLanguagePropertyKeys = ['language', 'browserLanguage', 'systemLanguage', 'userLanguage'],
        i,
        language;

    // support for HTML 5.1 "navigator.languages"
    if (angular.isArray(nav.languages)) {
      for (i = 0; i < nav.languages.length; i++) {
        language = nav.languages[i];
        if (language && language.length) {
          return language;
        }
      }
    }

    // support for other well known properties in browsers
    for (i = 0; i < browserLanguagePropertyKeys.length; i++) {
      language = nav[browserLanguagePropertyKeys[i]];
      if (language && language.length) {
        return language;
      }
    }

    return null;
  };
  getFirstBrowserLanguage.displayName = 'angular-translate/service: getFirstBrowserLanguage';

  // tries to determine the browsers locale
  var getLocale = function () {
    return (getFirstBrowserLanguage() || '').split('-').join('_');
  };
  getLocale.displayName = 'angular-translate/service: getLocale';

  /**
   * @name indexOf
   * @private
   *
   * @description
   * indexOf polyfill. Kinda sorta.
   *
   * @param {array} array Array to search in.
   * @param {string} searchElement Element to search for.
   *
   * @returns {int} Index of search element.
   */
  var indexOf = function(array, searchElement) {
    for (var i = 0, len = array.length; i < len; i++) {
      if (array[i] === searchElement) {
        return i;
      }
    }
    return -1;
  };

  /**
   * @name trim
   * @private
   *
   * @description
   * trim polyfill
   *
   * @returns {string} The string stripped of whitespace from both ends
   */
  var trim = function() {
    return this.replace(/^\s+|\s+$/g, '');
  };

  var negotiateLocale = function (preferred) {

    var avail = [],
        locale = angular.lowercase(preferred),
        i = 0,
        n = $availableLanguageKeys.length;

    for (; i < n; i++) {
      avail.push(angular.lowercase($availableLanguageKeys[i]));
    }

    if (indexOf(avail, locale) > -1) {
      return preferred;
    }

    if ($languageKeyAliases) {
      var alias;
      for (var langKeyAlias in $languageKeyAliases) {
        var hasWildcardKey = false;
        var hasExactKey = Object.prototype.hasOwnProperty.call($languageKeyAliases, langKeyAlias) &&
          angular.lowercase(langKeyAlias) === angular.lowercase(preferred);

        if (langKeyAlias.slice(-1) === '*') {
          hasWildcardKey = langKeyAlias.slice(0, -1) === preferred.slice(0, langKeyAlias.length-1);
        }
        if (hasExactKey || hasWildcardKey) {
          alias = $languageKeyAliases[langKeyAlias];
          if (indexOf(avail, angular.lowercase(alias)) > -1) {
            return alias;
          }
        }
      }
    }

    var parts = preferred.split('_');

    if (parts.length > 1 && indexOf(avail, angular.lowercase(parts[0])) > -1) {
      return parts[0];
    }

    // If everything fails, just return the preferred, unchanged.
    return preferred;
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#translations
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Registers a new translation table for specific language key.
   *
   * To register a translation table for specific language, pass a defined language
   * key as first parameter.
   *
   * <pre>
   *  // register translation table for language: 'de_DE'
   *  $translateProvider.translations('de_DE', {
   *    'GREETING': 'Hallo Welt!'
   *  });
   *
   *  // register another one
   *  $translateProvider.translations('en_US', {
   *    'GREETING': 'Hello world!'
   *  });
   * </pre>
   *
   * When registering multiple translation tables for for the same language key,
   * the actual translation table gets extended. This allows you to define module
   * specific translation which only get added, once a specific module is loaded in
   * your app.
   *
   * Invoking this method with no arguments returns the translation table which was
   * registered with no language key. Invoking it with a language key returns the
   * related translation table.
   *
   * @param {string} key A language key.
   * @param {object} translationTable A plain old JavaScript object that represents a translation table.
   *
   */
  var translations = function (langKey, translationTable) {

    if (!langKey && !translationTable) {
      return $translationTable;
    }

    if (langKey && !translationTable) {
      if (angular.isString(langKey)) {
        return $translationTable[langKey];
      }
    } else {
      if (!angular.isObject($translationTable[langKey])) {
        $translationTable[langKey] = {};
      }
      angular.extend($translationTable[langKey], flatObject(translationTable));
    }
    return this;
  };

  this.translations = translations;

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#cloakClassName
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   *
   * Let's you change the class name for `translate-cloak` directive.
   * Default class name is `translate-cloak`.
   *
   * @param {string} name translate-cloak class name
   */
  this.cloakClassName = function (name) {
    if (!name) {
      return $cloakClassName;
    }
    $cloakClassName = name;
    return this;
  };

  /**
   * @name flatObject
   * @private
   *
   * @description
   * Flats an object. This function is used to flatten given translation data with
   * namespaces, so they are later accessible via dot notation.
   */
  var flatObject = function (data, path, result, prevKey) {
    var key, keyWithPath, keyWithShortPath, val;

    if (!path) {
      path = [];
    }
    if (!result) {
      result = {};
    }
    for (key in data) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) {
        continue;
      }
      val = data[key];
      if (angular.isObject(val)) {
        flatObject(val, path.concat(key), result, key);
      } else {
        keyWithPath = path.length ? ('' + path.join(NESTED_OBJECT_DELIMITER) + NESTED_OBJECT_DELIMITER + key) : key;
        if(path.length && key === prevKey){
          // Create shortcut path (foo.bar == foo.bar.bar)
          keyWithShortPath = '' + path.join(NESTED_OBJECT_DELIMITER);
          // Link it to original path
          result[keyWithShortPath] = '@:' + keyWithPath;
        }
        result[keyWithPath] = val;
      }
    }
    return result;
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#addInterpolation
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Adds interpolation services to angular-translate, so it can manage them.
   *
   * @param {object} factory Interpolation service factory
   */
  this.addInterpolation = function (factory) {
    $interpolatorFactories.push(factory);
    return this;
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#useMessageFormatInterpolation
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Tells angular-translate to use interpolation functionality of messageformat.js.
   * This is useful when having high level pluralization and gender selection.
   */
  this.useMessageFormatInterpolation = function () {
    return this.useInterpolation('$translateMessageFormatInterpolation');
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#useInterpolation
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Tells angular-translate which interpolation style to use as default, application-wide.
   * Simply pass a factory/service name. The interpolation service has to implement
   * the correct interface.
   *
   * @param {string} factory Interpolation service name.
   */
  this.useInterpolation = function (factory) {
    $interpolationFactory = factory;
    return this;
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#useSanitizeStrategy
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Simply sets a sanitation strategy type.
   *
   * @param {string} value Strategy type.
   */
  this.useSanitizeValueStrategy = function (value) {
    $interpolationSanitizationStrategy = value;
    return this;
  };

 /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#preferredLanguage
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Tells the module which of the registered translation tables to use for translation
   * at initial startup by passing a language key. Similar to `$translateProvider#use`
   * only that it says which language to **prefer**.
   *
   * @param {string} langKey A language key.
   *
   */
  this.preferredLanguage = function(langKey) {
    setupPreferredLanguage(langKey);
    return this;

  };
  var setupPreferredLanguage = function (langKey) {
    if (langKey) {
      $preferredLanguage = langKey;
    }
    return $preferredLanguage;
  };
  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#translationNotFoundIndicator
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Sets an indicator which is used when a translation isn't found. E.g. when
   * setting the indicator as 'X' and one tries to translate a translation id
   * called `NOT_FOUND`, this will result in `X NOT_FOUND X`.
   *
   * Internally this methods sets a left indicator and a right indicator using
   * `$translateProvider.translationNotFoundIndicatorLeft()` and
   * `$translateProvider.translationNotFoundIndicatorRight()`.
   *
   * **Note**: These methods automatically add a whitespace between the indicators
   * and the translation id.
   *
   * @param {string} indicator An indicator, could be any string.
   */
  this.translationNotFoundIndicator = function (indicator) {
    this.translationNotFoundIndicatorLeft(indicator);
    this.translationNotFoundIndicatorRight(indicator);
    return this;
  };

  /**
   * ngdoc function
   * @name pascalprecht.translate.$translateProvider#translationNotFoundIndicatorLeft
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Sets an indicator which is used when a translation isn't found left to the
   * translation id.
   *
   * @param {string} indicator An indicator.
   */
  this.translationNotFoundIndicatorLeft = function (indicator) {
    if (!indicator) {
      return $notFoundIndicatorLeft;
    }
    $notFoundIndicatorLeft = indicator;
    return this;
  };

  /**
   * ngdoc function
   * @name pascalprecht.translate.$translateProvider#translationNotFoundIndicatorLeft
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Sets an indicator which is used when a translation isn't found right to the
   * translation id.
   *
   * @param {string} indicator An indicator.
   */
  this.translationNotFoundIndicatorRight = function (indicator) {
    if (!indicator) {
      return $notFoundIndicatorRight;
    }
    $notFoundIndicatorRight = indicator;
    return this;
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#fallbackLanguage
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Tells the module which of the registered translation tables to use when missing translations
   * at initial startup by passing a language key. Similar to `$translateProvider#use`
   * only that it says which language to **fallback**.
   *
   * @param {string||array} langKey A language key.
   *
   */
  this.fallbackLanguage = function (langKey) {
    fallbackStack(langKey);
    return this;
  };

  var fallbackStack = function (langKey) {
    if (langKey) {
      if (angular.isString(langKey)) {
        $fallbackWasString = true;
        $fallbackLanguage = [ langKey ];
      } else if (angular.isArray(langKey)) {
        $fallbackWasString = false;
        $fallbackLanguage = langKey;
      }
      if (angular.isString($preferredLanguage)  && indexOf($fallbackLanguage, $preferredLanguage) < 0) {
        $fallbackLanguage.push($preferredLanguage);
      }

      return this;
    } else {
      if ($fallbackWasString) {
        return $fallbackLanguage[0];
      } else {
        return $fallbackLanguage;
      }
    }
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#use
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Set which translation table to use for translation by given language key. When
   * trying to 'use' a language which isn't provided, it'll throw an error.
   *
   * You actually don't have to use this method since `$translateProvider#preferredLanguage`
   * does the job too.
   *
   * @param {string} langKey A language key.
   */
  this.use = function (langKey) {
    if (langKey) {
      if (!$translationTable[langKey] && (!$loaderFactory)) {
        // only throw an error, when not loading translation data asynchronously
        throw new Error("$translateProvider couldn't find translationTable for langKey: '" + langKey + "'");
      }
      $uses = langKey;
      return this;
    }
    return $uses;
  };

 /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#storageKey
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Tells the module which key must represent the choosed language by a user in the storage.
   *
   * @param {string} key A key for the storage.
   */
  var storageKey = function(key) {
    if (!key) {
      if ($storagePrefix) {
        return $storagePrefix + $storageKey;
      }
      return $storageKey;
    }
    $storageKey = key;
  };

  this.storageKey = storageKey;

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#useUrlLoader
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Tells angular-translate to use `$translateUrlLoader` extension service as loader.
   *
   * @param {string} url Url
   * @param {Object=} options Optional configuration object
   */
  this.useUrlLoader = function (url, options) {
    return this.useLoader('$translateUrlLoader', angular.extend({ url: url }, options));
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#useStaticFilesLoader
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Tells angular-translate to use `$translateStaticFilesLoader` extension service as loader.
   *
   * @param {Object=} options Optional configuration object
   */
  this.useStaticFilesLoader = function (options) {
    return this.useLoader('$translateStaticFilesLoader', options);
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#useLoader
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Tells angular-translate to use any other service as loader.
   *
   * @param {string} loaderFactory Factory name to use
   * @param {Object=} options Optional configuration object
   */
  this.useLoader = function (loaderFactory, options) {
    $loaderFactory = loaderFactory;
    $loaderOptions = options || {};
    return this;
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#useLocalStorage
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Tells angular-translate to use `$translateLocalStorage` service as storage layer.
   *
   */
  this.useLocalStorage = function () {
    return this.useStorage('$translateLocalStorage');
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#useCookieStorage
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Tells angular-translate to use `$translateCookieStorage` service as storage layer.
   */
  this.useCookieStorage = function () {
    return this.useStorage('$translateCookieStorage');
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#useStorage
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Tells angular-translate to use custom service as storage layer.
   */
  this.useStorage = function (storageFactory) {
    $storageFactory = storageFactory;
    return this;
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#storagePrefix
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Sets prefix for storage key.
   *
   * @param {string} prefix Storage key prefix
   */
  this.storagePrefix = function (prefix) {
    if (!prefix) {
      return prefix;
    }
    $storagePrefix = prefix;
    return this;
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#useMissingTranslationHandlerLog
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Tells angular-translate to use built-in log handler when trying to translate
   * a translation Id which doesn't exist.
   *
   * This is actually a shortcut method for `useMissingTranslationHandler()`.
   *
   */
  this.useMissingTranslationHandlerLog = function () {
    return this.useMissingTranslationHandler('$translateMissingTranslationHandlerLog');
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#useMissingTranslationHandler
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Expects a factory name which later gets instantiated with `$injector`.
   * This method can be used to tell angular-translate to use a custom
   * missingTranslationHandler. Just build a factory which returns a function
   * and expects a translation id as argument.
   *
   * Example:
   * <pre>
   *  app.config(function ($translateProvider) {
   *    $translateProvider.useMissingTranslationHandler('customHandler');
   *  });
   *
   *  app.factory('customHandler', function (dep1, dep2) {
   *    return function (translationId) {
   *      // something with translationId and dep1 and dep2
   *    };
   *  });
   * </pre>
   *
   * @param {string} factory Factory name
   */
  this.useMissingTranslationHandler = function (factory) {
    $missingTranslationHandlerFactory = factory;
    return this;
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#usePostCompiling
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * If post compiling is enabled, all translated values will be processed
   * again with AngularJS' $compile.
   *
   * Example:
   * <pre>
   *  app.config(function ($translateProvider) {
   *    $translateProvider.usePostCompiling(true);
   *  });
   * </pre>
   *
   * @param {string} factory Factory name
   */
  this.usePostCompiling = function (value) {
    $postCompilingEnabled = !(!value);
    return this;
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#determinePreferredLanguage
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Tells angular-translate to try to determine on its own which language key
   * to set as preferred language. When `fn` is given, angular-translate uses it
   * to determine a language key, otherwise it uses the built-in `getLocale()`
   * method.
   *
   * The `getLocale()` returns a language key in the format `[lang]_[country]` or
   * `[lang]` depending on what the browser provides.
   *
   * Use this method at your own risk, since not all browsers return a valid
   * locale.
   *
   * @param {object=} fn Function to determine a browser's locale
   */
  this.determinePreferredLanguage = function (fn) {

    var locale = (fn && angular.isFunction(fn)) ? fn() : getLocale();

    if (!$availableLanguageKeys.length) {
      $preferredLanguage = locale;
    } else {
      $preferredLanguage = negotiateLocale(locale);
    }

    return this;
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#registerAvailableLanguageKeys
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Registers a set of language keys the app will work with. Use this method in
   * combination with
   * {@link pascalprecht.translate.$translateProvider#determinePreferredLanguage determinePreferredLanguage}.
   * When available languages keys are registered, angular-translate
   * tries to find the best fitting language key depending on the browsers locale,
   * considering your language key convention.
   *
   * @param {object} languageKeys Array of language keys the your app will use
   * @param {object=} aliases Alias map.
   */
  this.registerAvailableLanguageKeys = function (languageKeys, aliases) {
    if (languageKeys) {
      $availableLanguageKeys = languageKeys;
      if (aliases) {
        $languageKeyAliases = aliases;
      }
      return this;
    }
    return $availableLanguageKeys;
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#useLoaderCache
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Registers a cache for internal $http based loaders.
   * {@link pascalprecht.translate.$translateProvider#determinePreferredLanguage determinePreferredLanguage}.
   * When false the cache will be disabled (default). When true or undefined
   * the cache will be a default (see $cacheFactory). When an object it will
   * be treat as a cache object itself: the usage is $http({cache: cache})
   *
   * @param {object} cache boolean, string or cache-object
   */
  this.useLoaderCache = function (cache) {
    if (cache === false) {
      // disable cache
      loaderCache = undefined;
    } else if (cache === true) {
      // enable cache using AJS defaults
      loaderCache = true;
    } else if (typeof(cache) === 'undefined') {
      // enable cache using default
      loaderCache = '$translationCache';
    } else if (cache) {
      // enable cache using given one (see $cacheFactory)
      loaderCache = cache;
    }
    return this;
  };

  /**
   * @ngdoc object
   * @name pascalprecht.translate.$translate
   * @requires $interpolate
   * @requires $log
   * @requires $rootScope
   * @requires $q
   *
   * @description
   * The `$translate` service is the actual core of angular-translate. It expects a translation id
   * and optional interpolate parameters to translate contents.
   *
   * <pre>
   *  $translate('HEADLINE_TEXT').then(function (translation) {
   *    $scope.translatedText = translation;
   *  });
   * </pre>
   *
   * @param {string|array} translationId A token which represents a translation id
   *                                     This can be optionally an array of translation ids which
   *                                     results that the function returns an object where each key
   *                                     is the translation id and the value the translation.
   * @param {object=} interpolateParams An object hash for dynamic values
   * @param {string} interpolationId The id of the interpolation to use
   * @returns {object} promise
   */
  this.$get = [
    '$log',
    '$injector',
    '$rootScope',
    '$q',
    function ($log, $injector, $rootScope, $q) {

      var Storage,
          defaultInterpolator = $injector.get($interpolationFactory || '$translateDefaultInterpolation'),
          pendingLoader = false,
          interpolatorHashMap = {},
          langPromises = {},
          fallbackIndex,
          startFallbackIteration;

      var $translate = function (translationId, interpolateParams, interpolationId) {

        // Duck detection: If the first argument is an array, a bunch of translations was requested.
        // The result is an object.
        if (angular.isArray(translationId)) {
          // Inspired by Q.allSettled by Kris Kowal
          // https://github.com/kriskowal/q/blob/b0fa72980717dc202ffc3cbf03b936e10ebbb9d7/q.js#L1553-1563
          // This transforms all promises regardless resolved or rejected
          var translateAll = function (translationIds) {
            var results = {}; // storing the actual results
            var promises = []; // promises to wait for
            // Wraps the promise a) being always resolved and b) storing the link id->value
            var translate = function (translationId) {
              var deferred = $q.defer();
              var regardless = function (value) {
                results[translationId] = value;
                deferred.resolve([translationId, value]);
              };
              // we don't care whether the promise was resolved or rejected; just store the values
              $translate(translationId, interpolateParams, interpolationId).then(regardless, regardless);
              return deferred.promise;
            };
            for (var i = 0, c = translationIds.length; i < c; i++) {
              promises.push(translate(translationIds[i]));
            }
            // wait for all (including storing to results)
            return $q.all(promises).then(function () {
              // return the results
              return results;
            });
          };
          return translateAll(translationId);
        }

        var deferred = $q.defer();

        // trim off any whitespace
        if (translationId) {
          translationId = trim.apply(translationId);
        }

        var promiseToWaitFor = (function () {
          var promise = $preferredLanguage ?
            langPromises[$preferredLanguage] :
            langPromises[$uses];

          fallbackIndex = 0;

          if ($storageFactory && !promise) {
            // looks like there's no pending promise for $preferredLanguage or
            // $uses. Maybe there's one pending for a language that comes from
            // storage.
            var langKey = Storage.get($storageKey);
            promise = langPromises[langKey];

            if ($fallbackLanguage && $fallbackLanguage.length) {
                var index = indexOf($fallbackLanguage, langKey);
                // maybe the language from storage is also defined as fallback language
                // we increase the fallback language index to not search in that language
                // as fallback, since it's probably the first used language
                // in that case the index starts after the first element
                fallbackIndex = (index === 0) ? 1 : 0;

                // but we can make sure to ALWAYS fallback to preferred language at least
                if (indexOf($fallbackLanguage, $preferredLanguage) < 0) {
                  $fallbackLanguage.push($preferredLanguage);
                }
            }
          }
          return promise;
        }());

        if (!promiseToWaitFor) {
          // no promise to wait for? okay. Then there's no loader registered
          // nor is a one pending for language that comes from storage.
          // We can just translate.
          determineTranslation(translationId, interpolateParams, interpolationId).then(deferred.resolve, deferred.reject);
        } else {
          promiseToWaitFor.then(function () {
            determineTranslation(translationId, interpolateParams, interpolationId).then(deferred.resolve, deferred.reject);
          }, deferred.reject);
        }
        return deferred.promise;
      };

      /**
       * @name applyNotFoundIndicators
       * @private
       *
       * @description
       * Applies not fount indicators to given translation id, if needed.
       * This function gets only executed, if a translation id doesn't exist,
       * which is why a translation id is expected as argument.
       *
       * @param {string} translationId Translation id.
       * @returns {string} Same as given translation id but applied with not found
       * indicators.
       */
      var applyNotFoundIndicators = function (translationId) {
        // applying notFoundIndicators
        if ($notFoundIndicatorLeft) {
          translationId = [$notFoundIndicatorLeft, translationId].join(' ');
        }
        if ($notFoundIndicatorRight) {
          translationId = [translationId, $notFoundIndicatorRight].join(' ');
        }
        return translationId;
      };

      /**
       * @name useLanguage
       * @private
       *
       * @description
       * Makes actual use of a language by setting a given language key as used
       * language and informs registered interpolators to also use the given
       * key as locale.
       *
       * @param {key} Locale key.
       */
      var useLanguage = function (key) {
        $uses = key;
        $rootScope.$emit('$translateChangeSuccess', {language: key});

        if ($storageFactory) {
          Storage.put($translate.storageKey(), $uses);
        }
        // inform default interpolator
        defaultInterpolator.setLocale($uses);
        // inform all others too!
        angular.forEach(interpolatorHashMap, function (interpolator, id) {
          interpolatorHashMap[id].setLocale($uses);
        });
        $rootScope.$emit('$translateChangeEnd', {language: key});
      };

      /**
       * @name loadAsync
       * @private
       *
       * @description
       * Kicks of registered async loader using `$injector` and applies existing
       * loader options. When resolved, it updates translation tables accordingly
       * or rejects with given language key.
       *
       * @param {string} key Language key.
       * @return {Promise} A promise.
       */
      var loadAsync = function (key) {
        if (!key) {
          throw 'No language key specified for loading.';
        }

        var deferred = $q.defer();

        $rootScope.$emit('$translateLoadingStart', {language: key});
        pendingLoader = true;

        var cache = loaderCache;
        if (typeof(cache) === 'string') {
          // getting on-demand instance of loader
          cache = $injector.get(cache);
        }

        var loaderOptions = angular.extend({}, $loaderOptions, {
          key: key,
          $http: angular.extend({}, {
            cache: cache
          }, $loaderOptions.$http)
        });

        $injector.get($loaderFactory)(loaderOptions).then(function (data) {
          var translationTable = {};
          $rootScope.$emit('$translateLoadingSuccess', {language: key});

          if (angular.isArray(data)) {
            angular.forEach(data, function (table) {
              angular.extend(translationTable, flatObject(table));
            });
          } else {
            angular.extend(translationTable, flatObject(data));
          }
          pendingLoader = false;
          deferred.resolve({
            key: key,
            table: translationTable
          });
          $rootScope.$emit('$translateLoadingEnd', {language: key});
        }, function (key) {
          $rootScope.$emit('$translateLoadingError', {language: key});
          deferred.reject(key);
          $rootScope.$emit('$translateLoadingEnd', {language: key});
        });
        return deferred.promise;
      };

      if ($storageFactory) {
        Storage = $injector.get($storageFactory);

        if (!Storage.get || !Storage.put) {
          throw new Error('Couldn\'t use storage \'' + $storageFactory + '\', missing get() or put() method!');
        }
      }

      // apply additional settings
      if (angular.isFunction(defaultInterpolator.useSanitizeValueStrategy)) {
        defaultInterpolator.useSanitizeValueStrategy($interpolationSanitizationStrategy);
      }

      // if we have additional interpolations that were added via
      // $translateProvider.addInterpolation(), we have to map'em
      if ($interpolatorFactories.length) {
        angular.forEach($interpolatorFactories, function (interpolatorFactory) {
          var interpolator = $injector.get(interpolatorFactory);
          // setting initial locale for each interpolation service
          interpolator.setLocale($preferredLanguage || $uses);
          // apply additional settings
          if (angular.isFunction(interpolator.useSanitizeValueStrategy)) {
            interpolator.useSanitizeValueStrategy($interpolationSanitizationStrategy);
          }
          // make'em recognizable through id
          interpolatorHashMap[interpolator.getInterpolationIdentifier()] = interpolator;
        });
      }

      /**
       * @name getTranslationTable
       * @private
       *
       * @description
       * Returns a promise that resolves to the translation table
       * or is rejected if an error occurred.
       *
       * @param langKey
       * @returns {Q.promise}
       */
      var getTranslationTable = function (langKey) {
        var deferred = $q.defer();
        if (Object.prototype.hasOwnProperty.call($translationTable, langKey)) {
          deferred.resolve($translationTable[langKey]);
        } else if (langPromises[langKey]) {
          langPromises[langKey].then(function (data) {
            translations(data.key, data.table);
            deferred.resolve(data.table);
          }, deferred.reject);
        } else {
          deferred.reject();
        }
        return deferred.promise;
      };

      /**
       * @name getFallbackTranslation
       * @private
       *
       * @description
       * Returns a promise that will resolve to the translation
       * or be rejected if no translation was found for the language.
       * This function is currently only used for fallback language translation.
       *
       * @param langKey The language to translate to.
       * @param translationId
       * @param interpolateParams
       * @param Interpolator
       * @returns {Q.promise}
       */
      var getFallbackTranslation = function (langKey, translationId, interpolateParams, Interpolator) {
        var deferred = $q.defer();

        getTranslationTable(langKey).then(function (translationTable) {
          if (Object.prototype.hasOwnProperty.call(translationTable, translationId)) {
            Interpolator.setLocale(langKey);
            deferred.resolve(Interpolator.interpolate(translationTable[translationId], interpolateParams));
            Interpolator.setLocale($uses);
          } else {
            deferred.reject();
          }
        }, deferred.reject);

        return deferred.promise;
      };

      /**
       * @name getFallbackTranslationInstant
       * @private
       *
       * @description
       * Returns a translation
       * This function is currently only used for fallback language translation.
       *
       * @param langKey The language to translate to.
       * @param translationId
       * @param interpolateParams
       * @param Interpolator
       * @returns {string} translation
       */
      var getFallbackTranslationInstant = function (langKey, translationId, interpolateParams, Interpolator) {
        var result, translationTable = $translationTable[langKey];

        if (translationTable && Object.prototype.hasOwnProperty.call(translationTable, translationId)) {
          Interpolator.setLocale(langKey);
          result = Interpolator.interpolate(translationTable[translationId], interpolateParams);
          Interpolator.setLocale($uses);
        }

        return result;
      };


      /**
       * @name translateByHandler
       * @private
       *
       * Translate by missing translation handler.
       *
       * @param translationId
       * @returns translation created by $missingTranslationHandler or translationId is $missingTranslationHandler is
       * absent
       */
      var translateByHandler = function (translationId) {
        // If we have a handler factory - we might also call it here to determine if it provides
        // a default text for a translationid that can't be found anywhere in our tables
        if ($missingTranslationHandlerFactory) {
          var resultString = $injector.get($missingTranslationHandlerFactory)(translationId, $uses);
          if (resultString !== undefined) {
            return resultString;
          } else {
            return translationId;
          }
        } else {
          return translationId;
        }
      };

      /**
       * @name resolveForFallbackLanguage
       * @private
       *
       * Recursive helper function for fallbackTranslation that will sequentially look
       * for a translation in the fallbackLanguages starting with fallbackLanguageIndex.
       *
       * @param fallbackLanguageIndex
       * @param translationId
       * @param interpolateParams
       * @param Interpolator
       * @returns {Q.promise} Promise that will resolve to the translation.
       */
      var resolveForFallbackLanguage = function (fallbackLanguageIndex, translationId, interpolateParams, Interpolator) {
        var deferred = $q.defer();

        if (fallbackLanguageIndex < $fallbackLanguage.length) {
          var langKey = $fallbackLanguage[fallbackLanguageIndex];
          getFallbackTranslation(langKey, translationId, interpolateParams, Interpolator).then(
            deferred.resolve,
            function () {
              // Look in the next fallback language for a translation.
              // It delays the resolving by passing another promise to resolve.
              resolveForFallbackLanguage(fallbackLanguageIndex + 1, translationId, interpolateParams, Interpolator).then(deferred.resolve);
            }
          );
        } else {
          // No translation found in any fallback language
          deferred.resolve(translateByHandler(translationId));
        }
        return deferred.promise;
      };

      /**
       * @name resolveForFallbackLanguageInstant
       * @private
       *
       * Recursive helper function for fallbackTranslation that will sequentially look
       * for a translation in the fallbackLanguages starting with fallbackLanguageIndex.
       *
       * @param fallbackLanguageIndex
       * @param translationId
       * @param interpolateParams
       * @param Interpolator
       * @returns {string} translation
       */
      var resolveForFallbackLanguageInstant = function (fallbackLanguageIndex, translationId, interpolateParams, Interpolator) {
        var result;

        if (fallbackLanguageIndex < $fallbackLanguage.length) {
          var langKey = $fallbackLanguage[fallbackLanguageIndex];
          result = getFallbackTranslationInstant(langKey, translationId, interpolateParams, Interpolator);
          if (!result) {
            result = resolveForFallbackLanguageInstant(fallbackLanguageIndex + 1, translationId, interpolateParams, Interpolator);
          }
        }
        return result;
      };

      /**
       * Translates with the usage of the fallback languages.
       *
       * @param translationId
       * @param interpolateParams
       * @param Interpolator
       * @returns {Q.promise} Promise, that resolves to the translation.
       */
      var fallbackTranslation = function (translationId, interpolateParams, Interpolator) {
        // Start with the fallbackLanguage with index 0
        return resolveForFallbackLanguage((startFallbackIteration>0 ? startFallbackIteration : fallbackIndex), translationId, interpolateParams, Interpolator);
      };

      /**
       * Translates with the usage of the fallback languages.
       *
       * @param translationId
       * @param interpolateParams
       * @param Interpolator
       * @returns {String} translation
       */
      var fallbackTranslationInstant = function (translationId, interpolateParams, Interpolator) {
        // Start with the fallbackLanguage with index 0
        return resolveForFallbackLanguageInstant((startFallbackIteration>0 ? startFallbackIteration : fallbackIndex), translationId, interpolateParams, Interpolator);
      };

      var determineTranslation = function (translationId, interpolateParams, interpolationId) {

        var deferred = $q.defer();

        var table = $uses ? $translationTable[$uses] : $translationTable,
            Interpolator = (interpolationId) ? interpolatorHashMap[interpolationId] : defaultInterpolator;

        // if the translation id exists, we can just interpolate it
        if (table && Object.prototype.hasOwnProperty.call(table, translationId)) {
          var translation = table[translationId];

          // If using link, rerun $translate with linked translationId and return it
          if (translation.substr(0, 2) === '@:') {

            $translate(translation.substr(2), interpolateParams, interpolationId)
              .then(deferred.resolve, deferred.reject);
          } else {
            deferred.resolve(Interpolator.interpolate(translation, interpolateParams));
          }
        } else {
          var missingTranslationHandlerTranslation;
          // for logging purposes only (as in $translateMissingTranslationHandlerLog), value is not returned to promise
          if ($missingTranslationHandlerFactory && !pendingLoader) {
            missingTranslationHandlerTranslation = translateByHandler(translationId);
          }

          // since we couldn't translate the inital requested translation id,
          // we try it now with one or more fallback languages, if fallback language(s) is
          // configured.
          if ($uses && $fallbackLanguage && $fallbackLanguage.length) {
            fallbackTranslation(translationId, interpolateParams, Interpolator)
                .then(function (translation) {
                  deferred.resolve(translation);
                }, function (_translationId) {
                  deferred.reject(applyNotFoundIndicators(_translationId));
                });
          } else if ($missingTranslationHandlerFactory && !pendingLoader && missingTranslationHandlerTranslation) {
            // looks like the requested translation id doesn't exists.
            // Now, if there is a registered handler for missing translations and no
            // asyncLoader is pending, we execute the handler
            deferred.resolve(missingTranslationHandlerTranslation);
          } else {
            deferred.reject(applyNotFoundIndicators(translationId));
          }
        }
        return deferred.promise;
      };

      var determineTranslationInstant = function (translationId, interpolateParams, interpolationId) {

        var result, table = $uses ? $translationTable[$uses] : $translationTable,
            Interpolator = (interpolationId) ? interpolatorHashMap[interpolationId] : defaultInterpolator;

        // if the translation id exists, we can just interpolate it
        if (table && Object.prototype.hasOwnProperty.call(table, translationId)) {
          var translation = table[translationId];

          // If using link, rerun $translate with linked translationId and return it
          if (translation.substr(0, 2) === '@:') {
            result = determineTranslationInstant(translation.substr(2), interpolateParams, interpolationId);
          } else {
            result = Interpolator.interpolate(translation, interpolateParams);
          }
        } else {
          var missingTranslationHandlerTranslation;
          // for logging purposes only (as in $translateMissingTranslationHandlerLog), value is not returned to promise
          if ($missingTranslationHandlerFactory && !pendingLoader) {
            missingTranslationHandlerTranslation = translateByHandler(translationId);
          }

          // since we couldn't translate the inital requested translation id,
          // we try it now with one or more fallback languages, if fallback language(s) is
          // configured.
          if ($uses && $fallbackLanguage && $fallbackLanguage.length) {
            fallbackIndex = 0;
            result = fallbackTranslationInstant(translationId, interpolateParams, Interpolator);
          } else if ($missingTranslationHandlerFactory && !pendingLoader && missingTranslationHandlerTranslation) {
            // looks like the requested translation id doesn't exists.
            // Now, if there is a registered handler for missing translations and no
            // asyncLoader is pending, we execute the handler
            result = missingTranslationHandlerTranslation;
          } else {
            result = applyNotFoundIndicators(translationId);
          }
        }

        return result;
      };

      /**
       * @ngdoc function
       * @name pascalprecht.translate.$translate#preferredLanguage
       * @methodOf pascalprecht.translate.$translate
       *
       * @description
       * Returns the language key for the preferred language.
       *
       * @param {string} langKey language String or Array to be used as preferredLanguage (changing at runtime)
       *
       * @return {string} preferred language key
       */
      $translate.preferredLanguage = function (langKey) {
        if(langKey) {
          setupPreferredLanguage(langKey);
        }
        return $preferredLanguage;
      };

      /**
       * @ngdoc function
       * @name pascalprecht.translate.$translate#cloakClassName
       * @methodOf pascalprecht.translate.$translate
       *
       * @description
       * Returns the configured class name for `translate-cloak` directive.
       *
       * @return {string} cloakClassName
       */
      $translate.cloakClassName = function () {
        return $cloakClassName;
      };

      /**
       * @ngdoc function
       * @name pascalprecht.translate.$translate#fallbackLanguage
       * @methodOf pascalprecht.translate.$translate
       *
       * @description
       * Returns the language key for the fallback languages or sets a new fallback stack.
       *
       * @param {string=} langKey language String or Array of fallback languages to be used (to change stack at runtime)
       *
       * @return {string||array} fallback language key
       */
      $translate.fallbackLanguage = function (langKey) {
        if (langKey !== undefined && langKey !== null) {
          fallbackStack(langKey);

          // as we might have an async loader initiated and a new translation language might have been defined
          // we need to add the promise to the stack also. So - iterate.
          if ($loaderFactory) {
            if ($fallbackLanguage && $fallbackLanguage.length) {
              for (var i = 0, len = $fallbackLanguage.length; i < len; i++) {
                if (!langPromises[$fallbackLanguage[i]]) {
                  langPromises[$fallbackLanguage[i]] = loadAsync($fallbackLanguage[i]);
                }
              }
            }
          }
          $translate.use($translate.use());
        }
        if ($fallbackWasString) {
          return $fallbackLanguage[0];
        } else {
          return $fallbackLanguage;
        }

      };

      /**
       * @ngdoc function
       * @name pascalprecht.translate.$translate#useFallbackLanguage
       * @methodOf pascalprecht.translate.$translate
       *
       * @description
       * Sets the first key of the fallback language stack to be used for translation.
       * Therefore all languages in the fallback array BEFORE this key will be skipped!
       *
       * @param {string=} langKey Contains the langKey the iteration shall start with. Set to false if you want to
       * get back to the whole stack
       */
      $translate.useFallbackLanguage = function (langKey) {
        if (langKey !== undefined && langKey !== null) {
          if (!langKey) {
            startFallbackIteration = 0;
          } else {
            var langKeyPosition = indexOf($fallbackLanguage, langKey);
            if (langKeyPosition > -1) {
              startFallbackIteration = langKeyPosition;
            }
          }

        }

      };

      /**
       * @ngdoc function
       * @name pascalprecht.translate.$translate#proposedLanguage
       * @methodOf pascalprecht.translate.$translate
       *
       * @description
       * Returns the language key of language that is currently loaded asynchronously.
       *
       * @return {string} language key
       */
      $translate.proposedLanguage = function () {
        return $nextLang;
      };

      /**
       * @ngdoc function
       * @name pascalprecht.translate.$translate#storage
       * @methodOf pascalprecht.translate.$translate
       *
       * @description
       * Returns registered storage.
       *
       * @return {object} Storage
       */
      $translate.storage = function () {
        return Storage;
      };

      /**
       * @ngdoc function
       * @name pascalprecht.translate.$translate#use
       * @methodOf pascalprecht.translate.$translate
       *
       * @description
       * Tells angular-translate which language to use by given language key. This method is
       * used to change language at runtime. It also takes care of storing the language
       * key in a configured store to let your app remember the choosed language.
       *
       * When trying to 'use' a language which isn't available it tries to load it
       * asynchronously with registered loaders.
       *
       * Returns promise object with loaded language file data
       * @example
       * $translate.use("en_US").then(function(data){
       *   $scope.text = $translate("HELLO");
       * });
       *
       * @param {string} key Language key
       * @return {string} Language key
       */
      $translate.use = function (key) {
        if (!key) {
          return $uses;
        }

        var deferred = $q.defer();

        $rootScope.$emit('$translateChangeStart', {language: key});

        // Try to get the aliased language key
        var aliasedKey = negotiateLocale(key);
        if (aliasedKey) {
          key = aliasedKey;
        }

        // if there isn't a translation table for the language we've requested,
        // we load it asynchronously
        if (!$translationTable[key] && $loaderFactory && !langPromises[key]) {
          $nextLang = key;
          langPromises[key] = loadAsync(key).then(function (translation) {
            translations(translation.key, translation.table);
            deferred.resolve(translation.key);

            useLanguage(translation.key);
            if ($nextLang === key) {
              $nextLang = undefined;
            }
            return translation;
          }, function (key) {
            if ($nextLang === key) {
              $nextLang = undefined;
            }
            $rootScope.$emit('$translateChangeError', {language: key});
            deferred.reject(key);
            $rootScope.$emit('$translateChangeEnd', {language: key});
          });
        } else {
          deferred.resolve(key);
          useLanguage(key);
        }

        return deferred.promise;
      };

      /**
       * @ngdoc function
       * @name pascalprecht.translate.$translate#storageKey
       * @methodOf pascalprecht.translate.$translate
       *
       * @description
       * Returns the key for the storage.
       *
       * @return {string} storage key
       */
      $translate.storageKey = function () {
        return storageKey();
      };

      /**
       * @ngdoc function
       * @name pascalprecht.translate.$translate#isPostCompilingEnabled
       * @methodOf pascalprecht.translate.$translate
       *
       * @description
       * Returns whether post compiling is enabled or not
       *
       * @return {bool} storage key
       */
      $translate.isPostCompilingEnabled = function () {
        return $postCompilingEnabled;
      };

      /**
       * @ngdoc function
       * @name pascalprecht.translate.$translate#refresh
       * @methodOf pascalprecht.translate.$translate
       *
       * @description
       * Refreshes a translation table pointed by the given langKey. If langKey is not specified,
       * the module will drop all existent translation tables and load new version of those which
       * are currently in use.
       *
       * Refresh means that the module will drop target translation table and try to load it again.
       *
       * In case there are no loaders registered the refresh() method will throw an Error.
       *
       * If the module is able to refresh translation tables refresh() method will broadcast
       * $translateRefreshStart and $translateRefreshEnd events.
       *
       * @example
       * // this will drop all currently existent translation tables and reload those which are
       * // currently in use
       * $translate.refresh();
       * // this will refresh a translation table for the en_US language
       * $translate.refresh('en_US');
       *
       * @param {string} langKey A language key of the table, which has to be refreshed
       *
       * @return {promise} Promise, which will be resolved in case a translation tables refreshing
       * process is finished successfully, and reject if not.
       */
      $translate.refresh = function (langKey) {
        if (!$loaderFactory) {
          throw new Error('Couldn\'t refresh translation table, no loader registered!');
        }

        var deferred = $q.defer();

        function resolve() {
          deferred.resolve();
          $rootScope.$emit('$translateRefreshEnd', {language: langKey});
        }

        function reject() {
          deferred.reject();
          $rootScope.$emit('$translateRefreshEnd', {language: langKey});
        }

        $rootScope.$emit('$translateRefreshStart', {language: langKey});

        if (!langKey) {
          // if there's no language key specified we refresh ALL THE THINGS!
          var tables = [], loadingKeys = {};

          // reload registered fallback languages
          if ($fallbackLanguage && $fallbackLanguage.length) {
            for (var i = 0, len = $fallbackLanguage.length; i < len; i++) {
              tables.push(loadAsync($fallbackLanguage[i]));
              loadingKeys[$fallbackLanguage[i]] = true;
            }
          }

          // reload currently used language
          if ($uses && !loadingKeys[$uses]) {
            tables.push(loadAsync($uses));
          }

          $q.all(tables).then(function (tableData) {
            angular.forEach(tableData, function (data) {
              if ($translationTable[data.key]) {
                delete $translationTable[data.key];
              }
              translations(data.key, data.table);
            });
            if ($uses) {
              useLanguage($uses);
            }
            resolve();
          });

        } else if ($translationTable[langKey]) {

          loadAsync(langKey).then(function (data) {
            translations(data.key, data.table);
            if (langKey === $uses) {
              useLanguage($uses);
            }
            resolve();
          }, reject);

        } else {
          reject();
        }
        return deferred.promise;
      };

      /**
       * @ngdoc function
       * @name pascalprecht.translate.$translate#instant
       * @methodOf pascalprecht.translate.$translate
       *
       * @description
       * Returns a translation instantly from the internal state of loaded translation. All rules
       * regarding the current language, the preferred language of even fallback languages will be
       * used except any promise handling. If a language was not found, an asynchronous loading
       * will be invoked in the background.
       *
       * @param {string|array} translationId A token which represents a translation id
       *                                     This can be optionally an array of translation ids which
       *                                     results that the function's promise returns an object where
       *                                     each key is the translation id and the value the translation.
       * @param {object} interpolateParams Params
       * @param {string} interpolationId The id of the interpolation to use
       *
       * @return {string} translation
       */
      $translate.instant = function (translationId, interpolateParams, interpolationId) {

        // Detect undefined and null values to shorten the execution and prevent exceptions
        if (translationId === null || angular.isUndefined(translationId)) {
          return translationId;
        }

        // Duck detection: If the first argument is an array, a bunch of translations was requested.
        // The result is an object.
        if (angular.isArray(translationId)) {
          var results = {};
          for (var i = 0, c = translationId.length; i < c; i++) {
            results[translationId[i]] = $translate.instant(translationId[i], interpolateParams, interpolationId);
          }
          return results;
        }

        // We discarded unacceptable values. So we just need to verify if translationId is empty String
        if (angular.isString(translationId) && translationId.length < 1) {
          return translationId;
        }

        // trim off any whitespace
        if (translationId) {
          translationId = trim.apply(translationId);
        }

        var result, possibleLangKeys = [];
        if ($preferredLanguage) {
          possibleLangKeys.push($preferredLanguage);
        }
        if ($uses) {
          possibleLangKeys.push($uses);
        }
        if ($fallbackLanguage && $fallbackLanguage.length) {
          possibleLangKeys = possibleLangKeys.concat($fallbackLanguage);
        }
        for (var j = 0, d = possibleLangKeys.length; j < d; j++) {
          var possibleLangKey = possibleLangKeys[j];
          if ($translationTable[possibleLangKey]) {
            if (typeof $translationTable[possibleLangKey][translationId] !== 'undefined') {
              result = determineTranslationInstant(translationId, interpolateParams, interpolationId);
            }
          }
          if (typeof result !== 'undefined') {
            break;
          }
        }

        if (!result && result !== '') {
          // Return translation of default interpolator if not found anything.
          result = defaultInterpolator.interpolate(translationId, interpolateParams);
          if ($missingTranslationHandlerFactory && !pendingLoader) {
            result = translateByHandler(translationId);
          }
        }

        return result;
      };

      /**
       * @ngdoc function
       * @name pascalprecht.translate.$translate#versionInfo
       * @methodOf pascalprecht.translate.$translate
       *
       * @description
       * Returns the current version information for the angular-translate library
       *
       * @return {string} angular-translate version
       */
      $translate.versionInfo = function () {
        return version;
      };

      /**
       * @ngdoc function
       * @name pascalprecht.translate.$translate#loaderCache
       * @methodOf pascalprecht.translate.$translate
       *
       * @description
       * Returns the defined loaderCache.
       *
       * @return {boolean|string|object} current value of loaderCache
       */
      $translate.loaderCache = function () {
        return loaderCache;
      };

      if ($loaderFactory) {

        // If at least one async loader is defined and there are no
        // (default) translations available we should try to load them.
        if (angular.equals($translationTable, {})) {
          $translate.use($translate.use());
        }

        // Also, if there are any fallback language registered, we start
        // loading them asynchronously as soon as we can.
        if ($fallbackLanguage && $fallbackLanguage.length) {
          var processAsyncResult = function (translation) {
            translations(translation.key, translation.table);
            $rootScope.$emit('$translateChangeEnd', { language: translation.key });
            return translation;
          };
          for (var i = 0, len = $fallbackLanguage.length; i < len; i++) {
            langPromises[$fallbackLanguage[i]] = loadAsync($fallbackLanguage[i]).then(processAsyncResult);
          }
        }
      }

      return $translate;
    }
  ];
}]);

/**
 * @ngdoc object
 * @name pascalprecht.translate.$translateDefaultInterpolation
 * @requires $interpolate
 *
 * @description
 * Uses angular's `$interpolate` services to interpolate strings against some values.
 *
 * @return {object} $translateInterpolator Interpolator service
 */
angular.module('pascalprecht.translate').factory('$translateDefaultInterpolation', ['$interpolate', function ($interpolate) {

  var $translateInterpolator = {},
      $locale,
      $identifier = 'default',
      $sanitizeValueStrategy = null,
      // map of all sanitize strategies
      sanitizeValueStrategies = {
        escaped: function (params) {
          var result = {};
          for (var key in params) {
            if (Object.prototype.hasOwnProperty.call(params, key)) {
              result[key] = angular.element('<div></div>').text(params[key]).html();
            }
          }
          return result;
        }
      };

  var sanitizeParams = function (params) {
    var result;
    if (angular.isFunction(sanitizeValueStrategies[$sanitizeValueStrategy])) {
      result = sanitizeValueStrategies[$sanitizeValueStrategy](params);
    } else {
      result = params;
    }
    return result;
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateDefaultInterpolation#setLocale
   * @methodOf pascalprecht.translate.$translateDefaultInterpolation
   *
   * @description
   * Sets current locale (this is currently not use in this interpolation).
   *
   * @param {string} locale Language key or locale.
   */
  $translateInterpolator.setLocale = function (locale) {
    $locale = locale;
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateDefaultInterpolation#getInterpolationIdentifier
   * @methodOf pascalprecht.translate.$translateDefaultInterpolation
   *
   * @description
   * Returns an identifier for this interpolation service.
   *
   * @returns {string} $identifier
   */
  $translateInterpolator.getInterpolationIdentifier = function () {
    return $identifier;
  };

  $translateInterpolator.useSanitizeValueStrategy = function (value) {
    $sanitizeValueStrategy = value;
    return this;
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateDefaultInterpolation#interpolate
   * @methodOf pascalprecht.translate.$translateDefaultInterpolation
   *
   * @description
   * Interpolates given string agains given interpolate params using angulars
   * `$interpolate` service.
   *
   * @returns {string} interpolated string.
   */
  $translateInterpolator.interpolate = function (string, interpolateParams) {
    if ($sanitizeValueStrategy) {
      interpolateParams = sanitizeParams(interpolateParams);
    }
    return $interpolate(string)(interpolateParams || {});
  };

  return $translateInterpolator;
}]);

angular.module('pascalprecht.translate').constant('$STORAGE_KEY', 'NG_TRANSLATE_LANG_KEY');

angular.module('pascalprecht.translate')
/**
 * @ngdoc directive
 * @name pascalprecht.translate.directive:translate
 * @requires $compile
 * @requires $filter
 * @requires $interpolate
 * @restrict A
 *
 * @description
 * Translates given translation id either through attribute or DOM content.
 * Internally it uses `translate` filter to translate translation id. It possible to
 * pass an optional `translate-values` object literal as string into translation id.
 *
 * @param {string=} translate Translation id which could be either string or interpolated string.
 * @param {string=} translate-values Values to pass into translation id. Can be passed as object literal string or interpolated object.
 * @param {string=} translate-attr-ATTR translate Translation id and put it into ATTR attribute.
 * @param {string=} translate-default will be used unless translation was successful
 * @param {boolean=} translate-compile (default true if present) defines locally activation of {@link pascalprecht.translate.$translate#usePostCompiling}
 *
 * @example
   <example module="ngView">
    <file name="index.html">
      <div ng-controller="TranslateCtrl">

        <pre translate="TRANSLATION_ID"></pre>
        <pre translate>TRANSLATION_ID</pre>
        <pre translate translate-attr-title="TRANSLATION_ID"></pre>
        <pre translate="{{translationId}}"></pre>
        <pre translate>{{translationId}}</pre>
        <pre translate="WITH_VALUES" translate-values="{value: 5}"></pre>
        <pre translate translate-values="{value: 5}">WITH_VALUES</pre>
        <pre translate="WITH_VALUES" translate-values="{{values}}"></pre>
        <pre translate translate-values="{{values}}">WITH_VALUES</pre>
        <pre translate translate-attr-title="WITH_VALUES" translate-values="{{values}}"></pre>

      </div>
    </file>
    <file name="script.js">
      angular.module('ngView', ['pascalprecht.translate'])

      .config(function ($translateProvider) {

        $translateProvider.translations('en',{
          'TRANSLATION_ID': 'Hello there!',
          'WITH_VALUES': 'The following value is dynamic: {{value}}'
        }).preferredLanguage('en');

      });

      angular.module('ngView').controller('TranslateCtrl', function ($scope) {
        $scope.translationId = 'TRANSLATION_ID';

        $scope.values = {
          value: 78
        };
      });
    </file>
    <file name="scenario.js">
      it('should translate', function () {
        inject(function ($rootScope, $compile) {
          $rootScope.translationId = 'TRANSLATION_ID';

          element = $compile('<p translate="TRANSLATION_ID"></p>')($rootScope);
          $rootScope.$digest();
          expect(element.text()).toBe('Hello there!');

          element = $compile('<p translate="{{translationId}}"></p>')($rootScope);
          $rootScope.$digest();
          expect(element.text()).toBe('Hello there!');

          element = $compile('<p translate>TRANSLATION_ID</p>')($rootScope);
          $rootScope.$digest();
          expect(element.text()).toBe('Hello there!');

          element = $compile('<p translate>{{translationId}}</p>')($rootScope);
          $rootScope.$digest();
          expect(element.text()).toBe('Hello there!');

          element = $compile('<p translate translate-attr-title="TRANSLATION_ID"></p>')($rootScope);
          $rootScope.$digest();
          expect(element.attr('title')).toBe('Hello there!');
        });
      });
    </file>
   </example>
 */
.directive('translate', ['$translate', '$q', '$interpolate', '$compile', '$parse', '$rootScope', function ($translate, $q, $interpolate, $compile, $parse, $rootScope) {

  return {
    restrict: 'AE',
    scope: true,
    compile: function (tElement, tAttr) {

      var translateValuesExist = (tAttr.translateValues) ?
        tAttr.translateValues : undefined;

      var translateInterpolation = (tAttr.translateInterpolation) ?
        tAttr.translateInterpolation : undefined;

      var translateValueExist = tElement[0].outerHTML.match(/translate-value-+/i);

      var interpolateRegExp = "^(.*)(" + $interpolate.startSymbol() + ".*" + $interpolate.endSymbol() + ")(.*)",
          watcherRegExp = "^(.*)" + $interpolate.startSymbol() + "(.*)" + $interpolate.endSymbol() + "(.*)";

      return function linkFn(scope, iElement, iAttr) {

        scope.interpolateParams = {};
        scope.preText = "";
        scope.postText = "";
        var translationIds = {};

        // Ensures any change of the attribute "translate" containing the id will
        // be re-stored to the scope's "translationId".
        // If the attribute has no content, the element's text value (white spaces trimmed off) will be used.
        var observeElementTranslation = function (translationId) {
          if (angular.equals(translationId , '') || !angular.isDefined(translationId)) {
            // Resolve translation id by inner html if required
            var interpolateMatches = iElement.text().match(interpolateRegExp);
            // Interpolate translation id if required
            if (angular.isArray(interpolateMatches)) {
              scope.preText = interpolateMatches[1];
              scope.postText = interpolateMatches[3];
              translationIds.translate = $interpolate(interpolateMatches[2])(scope.$parent);
              watcherMatches = iElement.text().match(watcherRegExp);
              if (angular.isArray(watcherMatches) && watcherMatches[2] && watcherMatches[2].length) {
                scope.$watch(watcherMatches[2], function (newValue) {
                  translationIds.translate = newValue;
                  updateTranslations();
                });
              }
            } else {
              translationIds.translate = iElement.text().replace(/^\s+|\s+$/g,'');
            }
          } else {
            translationIds.translate = translationId;
          }
          updateTranslations();
        };

        var observeAttributeTranslation = function (translateAttr) {
          iAttr.$observe(translateAttr, function (translationId) {
            translationIds[translateAttr] = translationId;
            updateTranslations();
          });
        };

        iAttr.$observe('translate', function (translationId) {
          observeElementTranslation(translationId);
        });

        for (var translateAttr in iAttr) {
          if(iAttr.hasOwnProperty(translateAttr) && translateAttr.substr(0, 13) === 'translateAttr') {
            observeAttributeTranslation(translateAttr);
          }
        }

        iAttr.$observe('translateDefault', function (value) {
          scope.defaultText = value;
        });

        if (translateValuesExist) {
          iAttr.$observe('translateValues', function (interpolateParams) {
            if (interpolateParams) {
              scope.$parent.$watch(function () {
                angular.extend(scope.interpolateParams, $parse(interpolateParams)(scope.$parent));
              });
            }
          });
        }

        if (translateValueExist) {
          var observeValueAttribute = function (attrName) {
            iAttr.$observe(attrName, function (value) {
              var attributeName = angular.lowercase(attrName.substr(14, 1)) + attrName.substr(15);
              scope.interpolateParams[attributeName] = value;
            });
          };
          for (var attr in iAttr) {
            if (Object.prototype.hasOwnProperty.call(iAttr, attr) && attr.substr(0, 14) === 'translateValue' && attr !== 'translateValues') {
              observeValueAttribute(attr);
            }
          }
        }

        // Master update function
        var updateTranslations = function () {
          for (var key in translationIds) {
            if (translationIds.hasOwnProperty(key) && translationIds[key]) {
              updateTranslation(key, translationIds[key], scope, scope.interpolateParams);
            }
          }
        };

        // Put translation processing function outside loop
        var updateTranslation = function(translateAttr, translationId, scope, interpolateParams) {
          $translate(translationId, interpolateParams, translateInterpolation)
            .then(function (translation) {
              applyTranslation(translation, scope, true, translateAttr);
            }, function (translationId) {
              applyTranslation(translationId, scope, false, translateAttr);
            });
        };

        var applyTranslation = function (value, scope, successful, translateAttr) {
          if (translateAttr === 'translate') {
            // default translate into innerHTML
            if (!successful && typeof scope.defaultText !== 'undefined') {
              value = scope.defaultText;
            }
            iElement.html(scope.preText + value + scope.postText);
            var globallyEnabled = $translate.isPostCompilingEnabled();
            var locallyDefined = typeof tAttr.translateCompile !== 'undefined';
            var locallyEnabled = locallyDefined && tAttr.translateCompile !== 'false';
            if ((globallyEnabled && !locallyDefined) || locallyEnabled) {
              $compile(iElement.contents())(scope);
            }
          } else {
            // translate attribute
            if (!successful && typeof scope.defaultText !== 'undefined') {
              value = scope.defaultText;
            }
            var attributeName = iAttr.$attr[translateAttr].substr(15);
            iElement.attr(attributeName, value);
          }
        };

        scope.$watch('interpolateParams', updateTranslations, true);

        // Ensures the text will be refreshed after the current language was changed
        // w/ $translate.use(...)
        var unbind = $rootScope.$on('$translateChangeSuccess', updateTranslations);

        // ensure translation will be looked up at least one
        if (iElement.text().length) {
          observeElementTranslation('');
        }
        updateTranslations();
        scope.$on('$destroy', unbind);
      };
    }
  };
}]);

angular.module('pascalprecht.translate')
/**
 * @ngdoc directive
 * @name pascalprecht.translate.directive:translateCloak
 * @requires $rootScope
 * @requires $translate
 * @restrict A
 *
 * $description
 * Adds a `translate-cloak` class name to the given element where this directive
 * is applied initially and removes it, once a loader has finished loading.
 *
 * This directive can be used to prevent initial flickering when loading translation
 * data asynchronously.
 *
 * The class name is defined in
 * {@link pascalprecht.translate.$translateProvider#cloakClassName $translate.cloakClassName()}.
 *
 * @param {string=} translate-cloak If a translationId is provided, it will be used for showing
 *                                  or hiding the cloak. Basically it relies on the translation
 *                                  resolve.
 */
.directive('translateCloak', ['$rootScope', '$translate', function ($rootScope, $translate) {

  return {
    compile: function (tElement) {
      var applyCloak = function () {
        tElement.addClass($translate.cloakClassName());
      },
      removeCloak = function () {
        tElement.removeClass($translate.cloakClassName());
      },
      removeListener = $rootScope.$on('$translateChangeEnd', function () {
        removeCloak();
        removeListener();
        removeListener = null;
      });
      applyCloak();

      return function linkFn(scope, iElement, iAttr) {
        // Register a watcher for the defined translation allowing a fine tuned cloak
        if (iAttr.translateCloak && iAttr.translateCloak.length) {
          iAttr.$observe('translateCloak', function (translationId) {
            $translate(translationId).then(removeCloak, applyCloak);
          });
        }
      };
    }
  };
}]);

angular.module('pascalprecht.translate')
/**
 * @ngdoc filter
 * @name pascalprecht.translate.filter:translate
 * @requires $parse
 * @requires pascalprecht.translate.$translate
 * @function
 *
 * @description
 * Uses `$translate` service to translate contents. Accepts interpolate parameters
 * to pass dynamized values though translation.
 *
 * @param {string} translationId A translation id to be translated.
 * @param {*=} interpolateParams Optional object literal (as hash or string) to pass values into translation.
 *
 * @returns {string} Translated text.
 *
 * @example
   <example module="ngView">
    <file name="index.html">
      <div ng-controller="TranslateCtrl">

        <pre>{{ 'TRANSLATION_ID' | translate }}</pre>
        <pre>{{ translationId | translate }}</pre>
        <pre>{{ 'WITH_VALUES' | translate:'{value: 5}' }}</pre>
        <pre>{{ 'WITH_VALUES' | translate:values }}</pre>

      </div>
    </file>
    <file name="script.js">
      angular.module('ngView', ['pascalprecht.translate'])

      .config(function ($translateProvider) {

        $translateProvider.translations('en', {
          'TRANSLATION_ID': 'Hello there!',
          'WITH_VALUES': 'The following value is dynamic: {{value}}'
        });
        $translateProvider.preferredLanguage('en');

      });

      angular.module('ngView').controller('TranslateCtrl', function ($scope) {
        $scope.translationId = 'TRANSLATION_ID';

        $scope.values = {
          value: 78
        };
      });
    </file>
   </example>
 */
.filter('translate', ['$parse', '$translate', function ($parse, $translate) {
  var translateFilter = function (translationId, interpolateParams, interpolation) {

    if (!angular.isObject(interpolateParams)) {
      interpolateParams = $parse(interpolateParams)(this);
    }

    return $translate.instant(translationId, interpolateParams, interpolation);
  };

  // Since AngularJS 1.3, filters which are not stateless (depending at the scope)
  // have to explicit define this behavior.
  translateFilter.$stateful = true;

  return translateFilter;
}]);

/*!
 * angular-translate - v2.5.2 - 2014-12-10
 * http://github.com/angular-translate/angular-translate
 * Copyright (c) 2014 ; Licensed MIT
 */
angular.module('pascalprecht.translate')
/**
 * @ngdoc object
 * @name pascalprecht.translate.$translateStaticFilesLoader
 * @requires $q
 * @requires $http
 *
 * @description
 * Creates a loading function for a typical static file url pattern:
 * "lang-en_US.json", "lang-de_DE.json", etc. Using this builder,
 * the response of these urls must be an object of key-value pairs.
 *
 * @param {object} options Options object, which gets prefix, suffix and key.
 */
.factory('$translateStaticFilesLoader', ['$q', '$http', function ($q, $http) {

  return function (options) {

    if (!options || (!angular.isString(options.prefix) || !angular.isString(options.suffix))) {
      throw new Error('Couldn\'t load static files, no prefix or suffix specified!');
    }

    var deferred = $q.defer();

    $http(angular.extend({
      url: [
        options.prefix,
        options.key,
        options.suffix
      ].join(''),
      method: 'GET',
      params: ''
    }, options.$http)).success(function (data) {
      deferred.resolve(data);
    }).error(function (data) {
      deferred.reject(options.key);
    });

    return deferred.promise;
  };
}]);

"use strict";
/* global angular, window */

/**
 * Reimplementation of $translateStaticFilesLoader to handle missing files and locale hierarchy (en/en_US)
 */
angular.module("pascalprecht.translate").factory("$translateStaticFilesLoader", [
  "$q",
  "$http",
  function ($q, $http) {
    function loadTranslationFile(options, deferred) {
      $http(angular.extend({
        url: [
          options.prefix,
          options.key.toLowerCase(),
          options.suffix
        ].join(""),
        method: "GET",
        params: ""
      }, options.$http)).success(function (data) {
        deferred.resolve(data);
      }).error(function () {
        if(options.key.indexOf("_") >= 0) {
          var key = options.key.substr(0, options.key.lastIndexOf("_"));
          var opts = angular.extend({}, options, { key: key });
          
          loadTranslationFile(opts, deferred);
        }
        else {
          deferred.resolve("{}");
        }
        
      });
    }

    return function(options) {
      if (!options || (!angular.isString(options.prefix) || !angular.isString(options.suffix))) {
        throw new Error("Couldn\"t load static files, no prefix or suffix specified!");
      }

      var deferred = $q.defer();

      loadTranslationFile(options, deferred);

      return deferred.promise;
    };
  }
]);

angular.module("risevision.common.i18n", ["pascalprecht.translate", "risevision.common.i18n.config"])
.config(["$translateProvider", "LOCALES_PREFIX", "LOCALES_SUFIX", function ($translateProvider, LOCALES_PREFIX, LOCALES_SUFIX) {
  // Tries to determine the browsers locale
  $translateProvider.useStaticFilesLoader({
    prefix: LOCALES_PREFIX,
    suffix: LOCALES_SUFIX
  });
  
  $translateProvider
    .determinePreferredLanguage()
    .fallbackLanguage("en");
}]);

/* ========================================================================
 * Bootstrap: affix.js v3.2.0
 * http://getbootstrap.com/javascript/#affix
 * ========================================================================
 * Copyright 2011-2014 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // AFFIX CLASS DEFINITION
  // ======================

  var Affix = function (element, options) {
    this.options = $.extend({}, Affix.DEFAULTS, options)

    this.$target = $(this.options.target)
      .on('scroll.bs.affix.data-api', $.proxy(this.checkPosition, this))
      .on('click.bs.affix.data-api',  $.proxy(this.checkPositionWithEventLoop, this))

    this.$element     = $(element)
    this.affixed      =
    this.unpin        =
    this.pinnedOffset = null

    this.checkPosition()
  }

  Affix.VERSION  = '3.2.0'

  Affix.RESET    = 'affix affix-top affix-bottom'

  Affix.DEFAULTS = {
    offset: 0,
    target: window
  }

  Affix.prototype.getPinnedOffset = function () {
    if (this.pinnedOffset) return this.pinnedOffset
    this.$element.removeClass(Affix.RESET).addClass('affix')
    var scrollTop = this.$target.scrollTop()
    var position  = this.$element.offset()
    return (this.pinnedOffset = position.top - scrollTop)
  }

  Affix.prototype.checkPositionWithEventLoop = function () {
    setTimeout($.proxy(this.checkPosition, this), 1)
  }

  Affix.prototype.checkPosition = function () {
    if (!this.$element.is(':visible')) return

    var scrollHeight = $(document).height()
    var scrollTop    = this.$target.scrollTop()
    var position     = this.$element.offset()
    var offset       = this.options.offset
    var offsetTop    = offset.top
    var offsetBottom = offset.bottom

    if (typeof offset != 'object')         offsetBottom = offsetTop = offset
    if (typeof offsetTop == 'function')    offsetTop    = offset.top(this.$element)
    if (typeof offsetBottom == 'function') offsetBottom = offset.bottom(this.$element)

    var affix = this.unpin   != null && (scrollTop + this.unpin <= position.top) ? false :
                offsetBottom != null && (position.top + this.$element.height() >= scrollHeight - offsetBottom) ? 'bottom' :
                offsetTop    != null && (scrollTop <= offsetTop) ? 'top' : false

    if (this.affixed === affix) return
    if (this.unpin != null) this.$element.css('top', '')

    var affixType = 'affix' + (affix ? '-' + affix : '')
    var e         = $.Event(affixType + '.bs.affix')

    this.$element.trigger(e)

    if (e.isDefaultPrevented()) return

    this.affixed = affix
    this.unpin = affix == 'bottom' ? this.getPinnedOffset() : null

    this.$element
      .removeClass(Affix.RESET)
      .addClass(affixType)
      .trigger($.Event(affixType.replace('affix', 'affixed')))

    if (affix == 'bottom') {
      this.$element.offset({
        top: scrollHeight - this.$element.height() - offsetBottom
      })
    }
  }


  // AFFIX PLUGIN DEFINITION
  // =======================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.affix')
      var options = typeof option == 'object' && option

      if (!data) $this.data('bs.affix', (data = new Affix(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  var old = $.fn.affix

  $.fn.affix             = Plugin
  $.fn.affix.Constructor = Affix


  // AFFIX NO CONFLICT
  // =================

  $.fn.affix.noConflict = function () {
    $.fn.affix = old
    return this
  }


  // AFFIX DATA-API
  // ==============

  $(window).on('load', function () {
    $('[data-spy="affix"]').each(function () {
      var $spy = $(this)
      var data = $spy.data()

      data.offset = data.offset || {}

      if (data.offsetBottom) data.offset.bottom = data.offsetBottom
      if (data.offsetTop)    data.offset.top    = data.offsetTop

      Plugin.call($spy, data)
    })
  })

}(jQuery);

/* ========================================================================
 * Bootstrap: alert.js v3.2.0
 * http://getbootstrap.com/javascript/#alerts
 * ========================================================================
 * Copyright 2011-2014 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // ALERT CLASS DEFINITION
  // ======================

  var dismiss = '[data-dismiss="alert"]'
  var Alert   = function (el) {
    $(el).on('click', dismiss, this.close)
  }

  Alert.VERSION = '3.2.0'

  Alert.prototype.close = function (e) {
    var $this    = $(this)
    var selector = $this.attr('data-target')

    if (!selector) {
      selector = $this.attr('href')
      selector = selector && selector.replace(/.*(?=#[^\s]*$)/, '') // strip for ie7
    }

    var $parent = $(selector)

    if (e) e.preventDefault()

    if (!$parent.length) {
      $parent = $this.hasClass('alert') ? $this : $this.parent()
    }

    $parent.trigger(e = $.Event('close.bs.alert'))

    if (e.isDefaultPrevented()) return

    $parent.removeClass('in')

    function removeElement() {
      // detach from parent, fire event then clean up data
      $parent.detach().trigger('closed.bs.alert').remove()
    }

    $.support.transition && $parent.hasClass('fade') ?
      $parent
        .one('bsTransitionEnd', removeElement)
        .emulateTransitionEnd(150) :
      removeElement()
  }


  // ALERT PLUGIN DEFINITION
  // =======================

  function Plugin(option) {
    return this.each(function () {
      var $this = $(this)
      var data  = $this.data('bs.alert')

      if (!data) $this.data('bs.alert', (data = new Alert(this)))
      if (typeof option == 'string') data[option].call($this)
    })
  }

  var old = $.fn.alert

  $.fn.alert             = Plugin
  $.fn.alert.Constructor = Alert


  // ALERT NO CONFLICT
  // =================

  $.fn.alert.noConflict = function () {
    $.fn.alert = old
    return this
  }


  // ALERT DATA-API
  // ==============

  $(document).on('click.bs.alert.data-api', dismiss, Alert.prototype.close)

}(jQuery);

/* ========================================================================
 * Bootstrap: button.js v3.2.0
 * http://getbootstrap.com/javascript/#buttons
 * ========================================================================
 * Copyright 2011-2014 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // BUTTON PUBLIC CLASS DEFINITION
  // ==============================

  var Button = function (element, options) {
    this.$element  = $(element)
    this.options   = $.extend({}, Button.DEFAULTS, options)
    this.isLoading = false
  }

  Button.VERSION  = '3.2.0'

  Button.DEFAULTS = {
    loadingText: 'loading...'
  }

  Button.prototype.setState = function (state) {
    var d    = 'disabled'
    var $el  = this.$element
    var val  = $el.is('input') ? 'val' : 'html'
    var data = $el.data()

    state = state + 'Text'

    if (data.resetText == null) $el.data('resetText', $el[val]())

    $el[val](data[state] == null ? this.options[state] : data[state])

    // push to event loop to allow forms to submit
    setTimeout($.proxy(function () {
      if (state == 'loadingText') {
        this.isLoading = true
        $el.addClass(d).attr(d, d)
      } else if (this.isLoading) {
        this.isLoading = false
        $el.removeClass(d).removeAttr(d)
      }
    }, this), 0)
  }

  Button.prototype.toggle = function () {
    var changed = true
    var $parent = this.$element.closest('[data-toggle="buttons"]')

    if ($parent.length) {
      var $input = this.$element.find('input')
      if ($input.prop('type') == 'radio') {
        if ($input.prop('checked') && this.$element.hasClass('active')) changed = false
        else $parent.find('.active').removeClass('active')
      }
      if (changed) $input.prop('checked', !this.$element.hasClass('active')).trigger('change')
    }

    if (changed) this.$element.toggleClass('active')
  }


  // BUTTON PLUGIN DEFINITION
  // ========================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.button')
      var options = typeof option == 'object' && option

      if (!data) $this.data('bs.button', (data = new Button(this, options)))

      if (option == 'toggle') data.toggle()
      else if (option) data.setState(option)
    })
  }

  var old = $.fn.button

  $.fn.button             = Plugin
  $.fn.button.Constructor = Button


  // BUTTON NO CONFLICT
  // ==================

  $.fn.button.noConflict = function () {
    $.fn.button = old
    return this
  }


  // BUTTON DATA-API
  // ===============

  $(document).on('click.bs.button.data-api', '[data-toggle^="button"]', function (e) {
    var $btn = $(e.target)
    if (!$btn.hasClass('btn')) $btn = $btn.closest('.btn')
    Plugin.call($btn, 'toggle')
    e.preventDefault()
  })

}(jQuery);

/* ========================================================================
 * Bootstrap: carousel.js v3.2.0
 * http://getbootstrap.com/javascript/#carousel
 * ========================================================================
 * Copyright 2011-2014 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // CAROUSEL CLASS DEFINITION
  // =========================

  var Carousel = function (element, options) {
    this.$element    = $(element).on('keydown.bs.carousel', $.proxy(this.keydown, this))
    this.$indicators = this.$element.find('.carousel-indicators')
    this.options     = options
    this.paused      =
    this.sliding     =
    this.interval    =
    this.$active     =
    this.$items      = null

    this.options.pause == 'hover' && this.$element
      .on('mouseenter.bs.carousel', $.proxy(this.pause, this))
      .on('mouseleave.bs.carousel', $.proxy(this.cycle, this))
  }

  Carousel.VERSION  = '3.2.0'

  Carousel.DEFAULTS = {
    interval: 5000,
    pause: 'hover',
    wrap: true
  }

  Carousel.prototype.keydown = function (e) {
    switch (e.which) {
      case 37: this.prev(); break
      case 39: this.next(); break
      default: return
    }

    e.preventDefault()
  }

  Carousel.prototype.cycle = function (e) {
    e || (this.paused = false)

    this.interval && clearInterval(this.interval)

    this.options.interval
      && !this.paused
      && (this.interval = setInterval($.proxy(this.next, this), this.options.interval))

    return this
  }

  Carousel.prototype.getItemIndex = function (item) {
    this.$items = item.parent().children('.item')
    return this.$items.index(item || this.$active)
  }

  Carousel.prototype.to = function (pos) {
    var that        = this
    var activeIndex = this.getItemIndex(this.$active = this.$element.find('.item.active'))

    if (pos > (this.$items.length - 1) || pos < 0) return

    if (this.sliding)       return this.$element.one('slid.bs.carousel', function () { that.to(pos) }) // yes, "slid"
    if (activeIndex == pos) return this.pause().cycle()

    return this.slide(pos > activeIndex ? 'next' : 'prev', $(this.$items[pos]))
  }

  Carousel.prototype.pause = function (e) {
    e || (this.paused = true)

    if (this.$element.find('.next, .prev').length && $.support.transition) {
      this.$element.trigger($.support.transition.end)
      this.cycle(true)
    }

    this.interval = clearInterval(this.interval)

    return this
  }

  Carousel.prototype.next = function () {
    if (this.sliding) return
    return this.slide('next')
  }

  Carousel.prototype.prev = function () {
    if (this.sliding) return
    return this.slide('prev')
  }

  Carousel.prototype.slide = function (type, next) {
    var $active   = this.$element.find('.item.active')
    var $next     = next || $active[type]()
    var isCycling = this.interval
    var direction = type == 'next' ? 'left' : 'right'
    var fallback  = type == 'next' ? 'first' : 'last'
    var that      = this

    if (!$next.length) {
      if (!this.options.wrap) return
      $next = this.$element.find('.item')[fallback]()
    }

    if ($next.hasClass('active')) return (this.sliding = false)

    var relatedTarget = $next[0]
    var slideEvent = $.Event('slide.bs.carousel', {
      relatedTarget: relatedTarget,
      direction: direction
    })
    this.$element.trigger(slideEvent)
    if (slideEvent.isDefaultPrevented()) return

    this.sliding = true

    isCycling && this.pause()

    if (this.$indicators.length) {
      this.$indicators.find('.active').removeClass('active')
      var $nextIndicator = $(this.$indicators.children()[this.getItemIndex($next)])
      $nextIndicator && $nextIndicator.addClass('active')
    }

    var slidEvent = $.Event('slid.bs.carousel', { relatedTarget: relatedTarget, direction: direction }) // yes, "slid"
    if ($.support.transition && this.$element.hasClass('slide')) {
      $next.addClass(type)
      $next[0].offsetWidth // force reflow
      $active.addClass(direction)
      $next.addClass(direction)
      $active
        .one('bsTransitionEnd', function () {
          $next.removeClass([type, direction].join(' ')).addClass('active')
          $active.removeClass(['active', direction].join(' '))
          that.sliding = false
          setTimeout(function () {
            that.$element.trigger(slidEvent)
          }, 0)
        })
        .emulateTransitionEnd($active.css('transition-duration').slice(0, -1) * 1000)
    } else {
      $active.removeClass('active')
      $next.addClass('active')
      this.sliding = false
      this.$element.trigger(slidEvent)
    }

    isCycling && this.cycle()

    return this
  }


  // CAROUSEL PLUGIN DEFINITION
  // ==========================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.carousel')
      var options = $.extend({}, Carousel.DEFAULTS, $this.data(), typeof option == 'object' && option)
      var action  = typeof option == 'string' ? option : options.slide

      if (!data) $this.data('bs.carousel', (data = new Carousel(this, options)))
      if (typeof option == 'number') data.to(option)
      else if (action) data[action]()
      else if (options.interval) data.pause().cycle()
    })
  }

  var old = $.fn.carousel

  $.fn.carousel             = Plugin
  $.fn.carousel.Constructor = Carousel


  // CAROUSEL NO CONFLICT
  // ====================

  $.fn.carousel.noConflict = function () {
    $.fn.carousel = old
    return this
  }


  // CAROUSEL DATA-API
  // =================

  $(document).on('click.bs.carousel.data-api', '[data-slide], [data-slide-to]', function (e) {
    var href
    var $this   = $(this)
    var $target = $($this.attr('data-target') || (href = $this.attr('href')) && href.replace(/.*(?=#[^\s]+$)/, '')) // strip for ie7
    if (!$target.hasClass('carousel')) return
    var options = $.extend({}, $target.data(), $this.data())
    var slideIndex = $this.attr('data-slide-to')
    if (slideIndex) options.interval = false

    Plugin.call($target, options)

    if (slideIndex) {
      $target.data('bs.carousel').to(slideIndex)
    }

    e.preventDefault()
  })

  $(window).on('load', function () {
    $('[data-ride="carousel"]').each(function () {
      var $carousel = $(this)
      Plugin.call($carousel, $carousel.data())
    })
  })

}(jQuery);

/* ========================================================================
 * Bootstrap: collapse.js v3.2.0
 * http://getbootstrap.com/javascript/#collapse
 * ========================================================================
 * Copyright 2011-2014 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // COLLAPSE PUBLIC CLASS DEFINITION
  // ================================

  var Collapse = function (element, options) {
    this.$element      = $(element)
    this.options       = $.extend({}, Collapse.DEFAULTS, options)
    this.transitioning = null

    if (this.options.parent) this.$parent = $(this.options.parent)
    if (this.options.toggle) this.toggle()
  }

  Collapse.VERSION  = '3.2.0'

  Collapse.DEFAULTS = {
    toggle: true
  }

  Collapse.prototype.dimension = function () {
    var hasWidth = this.$element.hasClass('width')
    return hasWidth ? 'width' : 'height'
  }

  Collapse.prototype.show = function () {
    if (this.transitioning || this.$element.hasClass('in')) return

    var startEvent = $.Event('show.bs.collapse')
    this.$element.trigger(startEvent)
    if (startEvent.isDefaultPrevented()) return

    var actives = this.$parent && this.$parent.find('> .panel > .in')

    if (actives && actives.length) {
      var hasData = actives.data('bs.collapse')
      if (hasData && hasData.transitioning) return
      Plugin.call(actives, 'hide')
      hasData || actives.data('bs.collapse', null)
    }

    var dimension = this.dimension()

    this.$element
      .removeClass('collapse')
      .addClass('collapsing')[dimension](0)

    this.transitioning = 1

    var complete = function () {
      this.$element
        .removeClass('collapsing')
        .addClass('collapse in')[dimension]('')
      this.transitioning = 0
      this.$element
        .trigger('shown.bs.collapse')
    }

    if (!$.support.transition) return complete.call(this)

    var scrollSize = $.camelCase(['scroll', dimension].join('-'))

    this.$element
      .one('bsTransitionEnd', $.proxy(complete, this))
      .emulateTransitionEnd(350)[dimension](this.$element[0][scrollSize])
  }

  Collapse.prototype.hide = function () {
    if (this.transitioning || !this.$element.hasClass('in')) return

    var startEvent = $.Event('hide.bs.collapse')
    this.$element.trigger(startEvent)
    if (startEvent.isDefaultPrevented()) return

    var dimension = this.dimension()

    this.$element[dimension](this.$element[dimension]())[0].offsetHeight

    this.$element
      .addClass('collapsing')
      .removeClass('collapse')
      .removeClass('in')

    this.transitioning = 1

    var complete = function () {
      this.transitioning = 0
      this.$element
        .trigger('hidden.bs.collapse')
        .removeClass('collapsing')
        .addClass('collapse')
    }

    if (!$.support.transition) return complete.call(this)

    this.$element
      [dimension](0)
      .one('bsTransitionEnd', $.proxy(complete, this))
      .emulateTransitionEnd(350)
  }

  Collapse.prototype.toggle = function () {
    this[this.$element.hasClass('in') ? 'hide' : 'show']()
  }


  // COLLAPSE PLUGIN DEFINITION
  // ==========================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.collapse')
      var options = $.extend({}, Collapse.DEFAULTS, $this.data(), typeof option == 'object' && option)

      if (!data && options.toggle && option == 'show') option = !option
      if (!data) $this.data('bs.collapse', (data = new Collapse(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  var old = $.fn.collapse

  $.fn.collapse             = Plugin
  $.fn.collapse.Constructor = Collapse


  // COLLAPSE NO CONFLICT
  // ====================

  $.fn.collapse.noConflict = function () {
    $.fn.collapse = old
    return this
  }


  // COLLAPSE DATA-API
  // =================

  $(document).on('click.bs.collapse.data-api', '[data-toggle="collapse"]', function (e) {
    var href
    var $this   = $(this)
    var target  = $this.attr('data-target')
        || e.preventDefault()
        || (href = $this.attr('href')) && href.replace(/.*(?=#[^\s]+$)/, '') // strip for ie7
    var $target = $(target)
    var data    = $target.data('bs.collapse')
    var option  = data ? 'toggle' : $this.data()
    var parent  = $this.attr('data-parent')
    var $parent = parent && $(parent)

    if (!data || !data.transitioning) {
      if ($parent) $parent.find('[data-toggle="collapse"][data-parent="' + parent + '"]').not($this).addClass('collapsed')
      $this[$target.hasClass('in') ? 'addClass' : 'removeClass']('collapsed')
    }

    Plugin.call($target, option)
  })

}(jQuery);

/* ========================================================================
 * Bootstrap: dropdown.js v3.2.0
 * http://getbootstrap.com/javascript/#dropdowns
 * ========================================================================
 * Copyright 2011-2014 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // DROPDOWN CLASS DEFINITION
  // =========================

  var backdrop = '.dropdown-backdrop'
  var toggle   = '[data-toggle="dropdown"]'
  var Dropdown = function (element) {
    $(element).on('click.bs.dropdown', this.toggle)
  }

  Dropdown.VERSION = '3.2.0'

  Dropdown.prototype.toggle = function (e) {
    var $this = $(this)

    if ($this.is('.disabled, :disabled')) return

    var $parent  = getParent($this)
    var isActive = $parent.hasClass('open')

    clearMenus()

    if (!isActive) {
      if ('ontouchstart' in document.documentElement && !$parent.closest('.navbar-nav').length) {
        // if mobile we use a backdrop because click events don't delegate
        $('<div class="dropdown-backdrop"/>').insertAfter($(this)).on('click', clearMenus)
      }

      var relatedTarget = { relatedTarget: this }
      $parent.trigger(e = $.Event('show.bs.dropdown', relatedTarget))

      if (e.isDefaultPrevented()) return

      $this.trigger('focus')

      $parent
        .toggleClass('open')
        .trigger('shown.bs.dropdown', relatedTarget)
    }

    return false
  }

  Dropdown.prototype.keydown = function (e) {
    if (!/(38|40|27)/.test(e.keyCode)) return

    var $this = $(this)

    e.preventDefault()
    e.stopPropagation()

    if ($this.is('.disabled, :disabled')) return

    var $parent  = getParent($this)
    var isActive = $parent.hasClass('open')

    if (!isActive || (isActive && e.keyCode == 27)) {
      if (e.which == 27) $parent.find(toggle).trigger('focus')
      return $this.trigger('click')
    }

    var desc = ' li:not(.divider):visible a'
    var $items = $parent.find('[role="menu"]' + desc + ', [role="listbox"]' + desc)

    if (!$items.length) return

    var index = $items.index($items.filter(':focus'))

    if (e.keyCode == 38 && index > 0)                 index--                        // up
    if (e.keyCode == 40 && index < $items.length - 1) index++                        // down
    if (!~index)                                      index = 0

    $items.eq(index).trigger('focus')
  }

  function clearMenus(e) {
    if (e && e.which === 3) return
    $(backdrop).remove()
    $(toggle).each(function () {
      var $parent = getParent($(this))
      var relatedTarget = { relatedTarget: this }
      if (!$parent.hasClass('open')) return
      $parent.trigger(e = $.Event('hide.bs.dropdown', relatedTarget))
      if (e.isDefaultPrevented()) return
      $parent.removeClass('open').trigger('hidden.bs.dropdown', relatedTarget)
    })
  }

  function getParent($this) {
    var selector = $this.attr('data-target')

    if (!selector) {
      selector = $this.attr('href')
      selector = selector && /#[A-Za-z]/.test(selector) && selector.replace(/.*(?=#[^\s]*$)/, '') // strip for ie7
    }

    var $parent = selector && $(selector)

    return $parent && $parent.length ? $parent : $this.parent()
  }


  // DROPDOWN PLUGIN DEFINITION
  // ==========================

  function Plugin(option) {
    return this.each(function () {
      var $this = $(this)
      var data  = $this.data('bs.dropdown')

      if (!data) $this.data('bs.dropdown', (data = new Dropdown(this)))
      if (typeof option == 'string') data[option].call($this)
    })
  }

  var old = $.fn.dropdown

  $.fn.dropdown             = Plugin
  $.fn.dropdown.Constructor = Dropdown


  // DROPDOWN NO CONFLICT
  // ====================

  $.fn.dropdown.noConflict = function () {
    $.fn.dropdown = old
    return this
  }


  // APPLY TO STANDARD DROPDOWN ELEMENTS
  // ===================================

  $(document)
    .on('click.bs.dropdown.data-api', clearMenus)
    .on('click.bs.dropdown.data-api', '.dropdown form', function (e) { e.stopPropagation() })
    .on('click.bs.dropdown.data-api', toggle, Dropdown.prototype.toggle)
    .on('keydown.bs.dropdown.data-api', toggle + ', [role="menu"], [role="listbox"]', Dropdown.prototype.keydown)

}(jQuery);

/* ========================================================================
 * Bootstrap: tab.js v3.2.0
 * http://getbootstrap.com/javascript/#tabs
 * ========================================================================
 * Copyright 2011-2014 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // TAB CLASS DEFINITION
  // ====================

  var Tab = function (element) {
    this.element = $(element)
  }

  Tab.VERSION = '3.2.0'

  Tab.prototype.show = function () {
    var $this    = this.element
    var $ul      = $this.closest('ul:not(.dropdown-menu)')
    var selector = $this.data('target')

    if (!selector) {
      selector = $this.attr('href')
      selector = selector && selector.replace(/.*(?=#[^\s]*$)/, '') // strip for ie7
    }

    if ($this.parent('li').hasClass('active')) return

    var previous = $ul.find('.active:last a')[0]
    var e        = $.Event('show.bs.tab', {
      relatedTarget: previous
    })

    $this.trigger(e)

    if (e.isDefaultPrevented()) return

    var $target = $(selector)

    this.activate($this.closest('li'), $ul)
    this.activate($target, $target.parent(), function () {
      $this.trigger({
        type: 'shown.bs.tab',
        relatedTarget: previous
      })
    })
  }

  Tab.prototype.activate = function (element, container, callback) {
    var $active    = container.find('> .active')
    var transition = callback
      && $.support.transition
      && $active.hasClass('fade')

    function next() {
      $active
        .removeClass('active')
        .find('> .dropdown-menu > .active')
        .removeClass('active')

      element.addClass('active')

      if (transition) {
        element[0].offsetWidth // reflow for transition
        element.addClass('in')
      } else {
        element.removeClass('fade')
      }

      if (element.parent('.dropdown-menu')) {
        element.closest('li.dropdown').addClass('active')
      }

      callback && callback()
    }

    transition ?
      $active
        .one('bsTransitionEnd', next)
        .emulateTransitionEnd(150) :
      next()

    $active.removeClass('in')
  }


  // TAB PLUGIN DEFINITION
  // =====================

  function Plugin(option) {
    return this.each(function () {
      var $this = $(this)
      var data  = $this.data('bs.tab')

      if (!data) $this.data('bs.tab', (data = new Tab(this)))
      if (typeof option == 'string') data[option]()
    })
  }

  var old = $.fn.tab

  $.fn.tab             = Plugin
  $.fn.tab.Constructor = Tab


  // TAB NO CONFLICT
  // ===============

  $.fn.tab.noConflict = function () {
    $.fn.tab = old
    return this
  }


  // TAB DATA-API
  // ============

  $(document).on('click.bs.tab.data-api', '[data-toggle="tab"], [data-toggle="pill"]', function (e) {
    e.preventDefault()
    Plugin.call($(this), 'show')
  })

}(jQuery);

/* ========================================================================
 * Bootstrap: transition.js v3.2.0
 * http://getbootstrap.com/javascript/#transitions
 * ========================================================================
 * Copyright 2011-2014 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // CSS TRANSITION SUPPORT (Shoutout: http://www.modernizr.com/)
  // ============================================================

  function transitionEnd() {
    var el = document.createElement('bootstrap')

    var transEndEventNames = {
      WebkitTransition : 'webkitTransitionEnd',
      MozTransition    : 'transitionend',
      OTransition      : 'oTransitionEnd otransitionend',
      transition       : 'transitionend'
    }

    for (var name in transEndEventNames) {
      if (el.style[name] !== undefined) {
        return { end: transEndEventNames[name] }
      }
    }

    return false // explicit for ie8 (  ._.)
  }

  // http://blog.alexmaccaw.com/css-transitions
  $.fn.emulateTransitionEnd = function (duration) {
    var called = false
    var $el = this
    $(this).one('bsTransitionEnd', function () { called = true })
    var callback = function () { if (!called) $($el).trigger($.support.transition.end) }
    setTimeout(callback, duration)
    return this
  }

  $(function () {
    $.support.transition = transitionEnd()

    if (!$.support.transition) return

    $.event.special.bsTransitionEnd = {
      bindType: $.support.transition.end,
      delegateType: $.support.transition.end,
      handle: function (e) {
        if ($(e.target).is(this)) return e.handleObj.handler.apply(this, arguments)
      }
    }
  })

}(jQuery);

/* ========================================================================
 * Bootstrap: scrollspy.js v3.2.0
 * http://getbootstrap.com/javascript/#scrollspy
 * ========================================================================
 * Copyright 2011-2014 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // SCROLLSPY CLASS DEFINITION
  // ==========================

  function ScrollSpy(element, options) {
    var process  = $.proxy(this.process, this)

    this.$body          = $('body')
    this.$scrollElement = $(element).is('body') ? $(window) : $(element)
    this.options        = $.extend({}, ScrollSpy.DEFAULTS, options)
    this.selector       = (this.options.target || '') + ' .nav li > a'
    this.offsets        = []
    this.targets        = []
    this.activeTarget   = null
    this.scrollHeight   = 0

    this.$scrollElement.on('scroll.bs.scrollspy', process)
    this.refresh()
    this.process()
  }

  ScrollSpy.VERSION  = '3.2.0'

  ScrollSpy.DEFAULTS = {
    offset: 10
  }

  ScrollSpy.prototype.getScrollHeight = function () {
    return this.$scrollElement[0].scrollHeight || Math.max(this.$body[0].scrollHeight, document.documentElement.scrollHeight)
  }

  ScrollSpy.prototype.refresh = function () {
    var offsetMethod = 'offset'
    var offsetBase   = 0

    if (!$.isWindow(this.$scrollElement[0])) {
      offsetMethod = 'position'
      offsetBase   = this.$scrollElement.scrollTop()
    }

    this.offsets = []
    this.targets = []
    this.scrollHeight = this.getScrollHeight()

    var self     = this

    this.$body
      .find(this.selector)
      .map(function () {
        var $el   = $(this)
        var href  = $el.data('target') || $el.attr('href')
        var $href = /^#./.test(href) && $(href)

        return ($href
          && $href.length
          && $href.is(':visible')
          && [[$href[offsetMethod]().top + offsetBase, href]]) || null
      })
      .sort(function (a, b) { return a[0] - b[0] })
      .each(function () {
        self.offsets.push(this[0])
        self.targets.push(this[1])
      })
  }

  ScrollSpy.prototype.process = function () {
    var scrollTop    = this.$scrollElement.scrollTop() + this.options.offset
    var scrollHeight = this.getScrollHeight()
    var maxScroll    = this.options.offset + scrollHeight - this.$scrollElement.height()
    var offsets      = this.offsets
    var targets      = this.targets
    var activeTarget = this.activeTarget
    var i

    if (this.scrollHeight != scrollHeight) {
      this.refresh()
    }

    if (scrollTop >= maxScroll) {
      return activeTarget != (i = targets[targets.length - 1]) && this.activate(i)
    }

    if (activeTarget && scrollTop <= offsets[0]) {
      return activeTarget != (i = targets[0]) && this.activate(i)
    }

    for (i = offsets.length; i--;) {
      activeTarget != targets[i]
        && scrollTop >= offsets[i]
        && (!offsets[i + 1] || scrollTop <= offsets[i + 1])
        && this.activate(targets[i])
    }
  }

  ScrollSpy.prototype.activate = function (target) {
    this.activeTarget = target

    $(this.selector)
      .parentsUntil(this.options.target, '.active')
      .removeClass('active')

    var selector = this.selector +
        '[data-target="' + target + '"],' +
        this.selector + '[href="' + target + '"]'

    var active = $(selector)
      .parents('li')
      .addClass('active')

    if (active.parent('.dropdown-menu').length) {
      active = active
        .closest('li.dropdown')
        .addClass('active')
    }

    active.trigger('activate.bs.scrollspy')
  }


  // SCROLLSPY PLUGIN DEFINITION
  // ===========================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.scrollspy')
      var options = typeof option == 'object' && option

      if (!data) $this.data('bs.scrollspy', (data = new ScrollSpy(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  var old = $.fn.scrollspy

  $.fn.scrollspy             = Plugin
  $.fn.scrollspy.Constructor = ScrollSpy


  // SCROLLSPY NO CONFLICT
  // =====================

  $.fn.scrollspy.noConflict = function () {
    $.fn.scrollspy = old
    return this
  }


  // SCROLLSPY DATA-API
  // ==================

  $(window).on('load.bs.scrollspy.data-api', function () {
    $('[data-spy="scroll"]').each(function () {
      var $spy = $(this)
      Plugin.call($spy, $spy.data())
    })
  })

}(jQuery);

/* ========================================================================
 * Bootstrap: modal.js v3.2.0
 * http://getbootstrap.com/javascript/#modals
 * ========================================================================
 * Copyright 2011-2014 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // MODAL CLASS DEFINITION
  // ======================

  var Modal = function (element, options) {
    this.options        = options
    this.$body          = $(document.body)
    this.$element       = $(element)
    this.$backdrop      =
    this.isShown        = null
    this.scrollbarWidth = 0

    if (this.options.remote) {
      this.$element
        .find('.modal-content')
        .load(this.options.remote, $.proxy(function () {
          this.$element.trigger('loaded.bs.modal')
        }, this))
    }
  }

  Modal.VERSION  = '3.2.0'

  Modal.DEFAULTS = {
    backdrop: true,
    keyboard: true,
    show: true
  }

  Modal.prototype.toggle = function (_relatedTarget) {
    return this.isShown ? this.hide() : this.show(_relatedTarget)
  }

  Modal.prototype.show = function (_relatedTarget) {
    var that = this
    var e    = $.Event('show.bs.modal', { relatedTarget: _relatedTarget })

    this.$element.trigger(e)

    if (this.isShown || e.isDefaultPrevented()) return

    this.isShown = true

    this.checkScrollbar()
    this.$body.addClass('modal-open')

    this.setScrollbar()
    this.escape()

    this.$element.on('click.dismiss.bs.modal', '[data-dismiss="modal"]', $.proxy(this.hide, this))

    this.backdrop(function () {
      var transition = $.support.transition && that.$element.hasClass('fade')

      if (!that.$element.parent().length) {
        that.$element.appendTo(that.$body) // don't move modals dom position
      }

      that.$element
        .show()
        .scrollTop(0)

      if (transition) {
        that.$element[0].offsetWidth // force reflow
      }

      that.$element
        .addClass('in')
        .attr('aria-hidden', false)

      that.enforceFocus()

      var e = $.Event('shown.bs.modal', { relatedTarget: _relatedTarget })

      transition ?
        that.$element.find('.modal-dialog') // wait for modal to slide in
          .one('bsTransitionEnd', function () {
            that.$element.trigger('focus').trigger(e)
          })
          .emulateTransitionEnd(300) :
        that.$element.trigger('focus').trigger(e)
    })
  }

  Modal.prototype.hide = function (e) {
    if (e) e.preventDefault()

    e = $.Event('hide.bs.modal')

    this.$element.trigger(e)

    if (!this.isShown || e.isDefaultPrevented()) return

    this.isShown = false

    this.$body.removeClass('modal-open')

    this.resetScrollbar()
    this.escape()

    $(document).off('focusin.bs.modal')

    this.$element
      .removeClass('in')
      .attr('aria-hidden', true)
      .off('click.dismiss.bs.modal')

    $.support.transition && this.$element.hasClass('fade') ?
      this.$element
        .one('bsTransitionEnd', $.proxy(this.hideModal, this))
        .emulateTransitionEnd(300) :
      this.hideModal()
  }

  Modal.prototype.enforceFocus = function () {
    $(document)
      .off('focusin.bs.modal') // guard against infinite focus loop
      .on('focusin.bs.modal', $.proxy(function (e) {
        if (this.$element[0] !== e.target && !this.$element.has(e.target).length) {
          this.$element.trigger('focus')
        }
      }, this))
  }

  Modal.prototype.escape = function () {
    if (this.isShown && this.options.keyboard) {
      this.$element.on('keyup.dismiss.bs.modal', $.proxy(function (e) {
        e.which == 27 && this.hide()
      }, this))
    } else if (!this.isShown) {
      this.$element.off('keyup.dismiss.bs.modal')
    }
  }

  Modal.prototype.hideModal = function () {
    var that = this
    this.$element.hide()
    this.backdrop(function () {
      that.$element.trigger('hidden.bs.modal')
    })
  }

  Modal.prototype.removeBackdrop = function () {
    this.$backdrop && this.$backdrop.remove()
    this.$backdrop = null
  }

  Modal.prototype.backdrop = function (callback) {
    var that = this
    var animate = this.$element.hasClass('fade') ? 'fade' : ''

    if (this.isShown && this.options.backdrop) {
      var doAnimate = $.support.transition && animate

      this.$backdrop = $('<div class="modal-backdrop ' + animate + '" />')
        .appendTo(this.$body)

      this.$element.on('click.dismiss.bs.modal', $.proxy(function (e) {
        if (e.target !== e.currentTarget) return
        this.options.backdrop == 'static'
          ? this.$element[0].focus.call(this.$element[0])
          : this.hide.call(this)
      }, this))

      if (doAnimate) this.$backdrop[0].offsetWidth // force reflow

      this.$backdrop.addClass('in')

      if (!callback) return

      doAnimate ?
        this.$backdrop
          .one('bsTransitionEnd', callback)
          .emulateTransitionEnd(150) :
        callback()

    } else if (!this.isShown && this.$backdrop) {
      this.$backdrop.removeClass('in')

      var callbackRemove = function () {
        that.removeBackdrop()
        callback && callback()
      }
      $.support.transition && this.$element.hasClass('fade') ?
        this.$backdrop
          .one('bsTransitionEnd', callbackRemove)
          .emulateTransitionEnd(150) :
        callbackRemove()

    } else if (callback) {
      callback()
    }
  }

  Modal.prototype.checkScrollbar = function () {
    if (document.body.clientWidth >= window.innerWidth) return
    this.scrollbarWidth = this.scrollbarWidth || this.measureScrollbar()
  }

  Modal.prototype.setScrollbar = function () {
    var bodyPad = parseInt((this.$body.css('padding-right') || 0), 10)
    if (this.scrollbarWidth) this.$body.css('padding-right', bodyPad + this.scrollbarWidth)
  }

  Modal.prototype.resetScrollbar = function () {
    this.$body.css('padding-right', '')
  }

  Modal.prototype.measureScrollbar = function () { // thx walsh
    var scrollDiv = document.createElement('div')
    scrollDiv.className = 'modal-scrollbar-measure'
    this.$body.append(scrollDiv)
    var scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth
    this.$body[0].removeChild(scrollDiv)
    return scrollbarWidth
  }


  // MODAL PLUGIN DEFINITION
  // =======================

  function Plugin(option, _relatedTarget) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.modal')
      var options = $.extend({}, Modal.DEFAULTS, $this.data(), typeof option == 'object' && option)

      if (!data) $this.data('bs.modal', (data = new Modal(this, options)))
      if (typeof option == 'string') data[option](_relatedTarget)
      else if (options.show) data.show(_relatedTarget)
    })
  }

  var old = $.fn.modal

  $.fn.modal             = Plugin
  $.fn.modal.Constructor = Modal


  // MODAL NO CONFLICT
  // =================

  $.fn.modal.noConflict = function () {
    $.fn.modal = old
    return this
  }


  // MODAL DATA-API
  // ==============

  $(document).on('click.bs.modal.data-api', '[data-toggle="modal"]', function (e) {
    var $this   = $(this)
    var href    = $this.attr('href')
    var $target = $($this.attr('data-target') || (href && href.replace(/.*(?=#[^\s]+$)/, ''))) // strip for ie7
    var option  = $target.data('bs.modal') ? 'toggle' : $.extend({ remote: !/#/.test(href) && href }, $target.data(), $this.data())

    if ($this.is('a')) e.preventDefault()

    $target.one('show.bs.modal', function (showEvent) {
      if (showEvent.isDefaultPrevented()) return // only register focus restorer if modal will actually get shown
      $target.one('hidden.bs.modal', function () {
        $this.is(':visible') && $this.trigger('focus')
      })
    })
    Plugin.call($target, option, this)
  })

}(jQuery);

/* ========================================================================
 * Bootstrap: tooltip.js v3.2.0
 * http://getbootstrap.com/javascript/#tooltip
 * Inspired by the original jQuery.tipsy by Jason Frame
 * ========================================================================
 * Copyright 2011-2014 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // TOOLTIP PUBLIC CLASS DEFINITION
  // ===============================

  var Tooltip = function (element, options) {
    this.type       =
    this.options    =
    this.enabled    =
    this.timeout    =
    this.hoverState =
    this.$element   = null

    this.init('tooltip', element, options)
  }

  Tooltip.VERSION  = '3.2.0'

  Tooltip.DEFAULTS = {
    animation: true,
    placement: 'top',
    selector: false,
    template: '<div class="tooltip" role="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div>',
    trigger: 'hover focus',
    title: '',
    delay: 0,
    html: false,
    container: false,
    viewport: {
      selector: 'body',
      padding: 0
    }
  }

  Tooltip.prototype.init = function (type, element, options) {
    this.enabled   = true
    this.type      = type
    this.$element  = $(element)
    this.options   = this.getOptions(options)
    this.$viewport = this.options.viewport && $(this.options.viewport.selector || this.options.viewport)

    var triggers = this.options.trigger.split(' ')

    for (var i = triggers.length; i--;) {
      var trigger = triggers[i]

      if (trigger == 'click') {
        this.$element.on('click.' + this.type, this.options.selector, $.proxy(this.toggle, this))
      } else if (trigger != 'manual') {
        var eventIn  = trigger == 'hover' ? 'mouseenter' : 'focusin'
        var eventOut = trigger == 'hover' ? 'mouseleave' : 'focusout'

        this.$element.on(eventIn  + '.' + this.type, this.options.selector, $.proxy(this.enter, this))
        this.$element.on(eventOut + '.' + this.type, this.options.selector, $.proxy(this.leave, this))
      }
    }

    this.options.selector ?
      (this._options = $.extend({}, this.options, { trigger: 'manual', selector: '' })) :
      this.fixTitle()
  }

  Tooltip.prototype.getDefaults = function () {
    return Tooltip.DEFAULTS
  }

  Tooltip.prototype.getOptions = function (options) {
    options = $.extend({}, this.getDefaults(), this.$element.data(), options)

    if (options.delay && typeof options.delay == 'number') {
      options.delay = {
        show: options.delay,
        hide: options.delay
      }
    }

    return options
  }

  Tooltip.prototype.getDelegateOptions = function () {
    var options  = {}
    var defaults = this.getDefaults()

    this._options && $.each(this._options, function (key, value) {
      if (defaults[key] != value) options[key] = value
    })

    return options
  }

  Tooltip.prototype.enter = function (obj) {
    var self = obj instanceof this.constructor ?
      obj : $(obj.currentTarget).data('bs.' + this.type)

    if (!self) {
      self = new this.constructor(obj.currentTarget, this.getDelegateOptions())
      $(obj.currentTarget).data('bs.' + this.type, self)
    }

    clearTimeout(self.timeout)

    self.hoverState = 'in'

    if (!self.options.delay || !self.options.delay.show) return self.show()

    self.timeout = setTimeout(function () {
      if (self.hoverState == 'in') self.show()
    }, self.options.delay.show)
  }

  Tooltip.prototype.leave = function (obj) {
    var self = obj instanceof this.constructor ?
      obj : $(obj.currentTarget).data('bs.' + this.type)

    if (!self) {
      self = new this.constructor(obj.currentTarget, this.getDelegateOptions())
      $(obj.currentTarget).data('bs.' + this.type, self)
    }

    clearTimeout(self.timeout)

    self.hoverState = 'out'

    if (!self.options.delay || !self.options.delay.hide) return self.hide()

    self.timeout = setTimeout(function () {
      if (self.hoverState == 'out') self.hide()
    }, self.options.delay.hide)
  }

  Tooltip.prototype.show = function () {
    var e = $.Event('show.bs.' + this.type)

    if (this.hasContent() && this.enabled) {
      this.$element.trigger(e)

      var inDom = $.contains(document.documentElement, this.$element[0])
      if (e.isDefaultPrevented() || !inDom) return
      var that = this

      var $tip = this.tip()

      var tipId = this.getUID(this.type)

      this.setContent()
      $tip.attr('id', tipId)
      this.$element.attr('aria-describedby', tipId)

      if (this.options.animation) $tip.addClass('fade')

      var placement = typeof this.options.placement == 'function' ?
        this.options.placement.call(this, $tip[0], this.$element[0]) :
        this.options.placement

      var autoToken = /\s?auto?\s?/i
      var autoPlace = autoToken.test(placement)
      if (autoPlace) placement = placement.replace(autoToken, '') || 'top'

      $tip
        .detach()
        .css({ top: 0, left: 0, display: 'block' })
        .addClass(placement)
        .data('bs.' + this.type, this)

      this.options.container ? $tip.appendTo(this.options.container) : $tip.insertAfter(this.$element)

      var pos          = this.getPosition()
      var actualWidth  = $tip[0].offsetWidth
      var actualHeight = $tip[0].offsetHeight

      if (autoPlace) {
        var orgPlacement = placement
        var $parent      = this.$element.parent()
        var parentDim    = this.getPosition($parent)

        placement = placement == 'bottom' && pos.top   + pos.height       + actualHeight - parentDim.scroll > parentDim.height ? 'top'    :
                    placement == 'top'    && pos.top   - parentDim.scroll - actualHeight < 0                                   ? 'bottom' :
                    placement == 'right'  && pos.right + actualWidth      > parentDim.width                                    ? 'left'   :
                    placement == 'left'   && pos.left  - actualWidth      < parentDim.left                                     ? 'right'  :
                    placement

        $tip
          .removeClass(orgPlacement)
          .addClass(placement)
      }

      var calculatedOffset = this.getCalculatedOffset(placement, pos, actualWidth, actualHeight)

      this.applyPlacement(calculatedOffset, placement)

      var complete = function () {
        that.$element.trigger('shown.bs.' + that.type)
        that.hoverState = null
      }

      $.support.transition && this.$tip.hasClass('fade') ?
        $tip
          .one('bsTransitionEnd', complete)
          .emulateTransitionEnd(150) :
        complete()
    }
  }

  Tooltip.prototype.applyPlacement = function (offset, placement) {
    var $tip   = this.tip()
    var width  = $tip[0].offsetWidth
    var height = $tip[0].offsetHeight

    // manually read margins because getBoundingClientRect includes difference
    var marginTop = parseInt($tip.css('margin-top'), 10)
    var marginLeft = parseInt($tip.css('margin-left'), 10)

    // we must check for NaN for ie 8/9
    if (isNaN(marginTop))  marginTop  = 0
    if (isNaN(marginLeft)) marginLeft = 0

    offset.top  = offset.top  + marginTop
    offset.left = offset.left + marginLeft

    // $.fn.offset doesn't round pixel values
    // so we use setOffset directly with our own function B-0
    $.offset.setOffset($tip[0], $.extend({
      using: function (props) {
        $tip.css({
          top: Math.round(props.top),
          left: Math.round(props.left)
        })
      }
    }, offset), 0)

    $tip.addClass('in')

    // check to see if placing tip in new offset caused the tip to resize itself
    var actualWidth  = $tip[0].offsetWidth
    var actualHeight = $tip[0].offsetHeight

    if (placement == 'top' && actualHeight != height) {
      offset.top = offset.top + height - actualHeight
    }

    var delta = this.getViewportAdjustedDelta(placement, offset, actualWidth, actualHeight)

    if (delta.left) offset.left += delta.left
    else offset.top += delta.top

    var arrowDelta          = delta.left ? delta.left * 2 - width + actualWidth : delta.top * 2 - height + actualHeight
    var arrowPosition       = delta.left ? 'left'        : 'top'
    var arrowOffsetPosition = delta.left ? 'offsetWidth' : 'offsetHeight'

    $tip.offset(offset)
    this.replaceArrow(arrowDelta, $tip[0][arrowOffsetPosition], arrowPosition)
  }

  Tooltip.prototype.replaceArrow = function (delta, dimension, position) {
    this.arrow().css(position, delta ? (50 * (1 - delta / dimension) + '%') : '')
  }

  Tooltip.prototype.setContent = function () {
    var $tip  = this.tip()
    var title = this.getTitle()

    $tip.find('.tooltip-inner')[this.options.html ? 'html' : 'text'](title)
    $tip.removeClass('fade in top bottom left right')
  }

  Tooltip.prototype.hide = function () {
    var that = this
    var $tip = this.tip()
    var e    = $.Event('hide.bs.' + this.type)

    this.$element.removeAttr('aria-describedby')

    function complete() {
      if (that.hoverState != 'in') $tip.detach()
      that.$element.trigger('hidden.bs.' + that.type)
    }

    this.$element.trigger(e)

    if (e.isDefaultPrevented()) return

    $tip.removeClass('in')

    $.support.transition && this.$tip.hasClass('fade') ?
      $tip
        .one('bsTransitionEnd', complete)
        .emulateTransitionEnd(150) :
      complete()

    this.hoverState = null

    return this
  }

  Tooltip.prototype.fixTitle = function () {
    var $e = this.$element
    if ($e.attr('title') || typeof ($e.attr('data-original-title')) != 'string') {
      $e.attr('data-original-title', $e.attr('title') || '').attr('title', '')
    }
  }

  Tooltip.prototype.hasContent = function () {
    return this.getTitle()
  }

  Tooltip.prototype.getPosition = function ($element) {
    $element   = $element || this.$element
    var el     = $element[0]
    var isBody = el.tagName == 'BODY'
    return $.extend({}, (typeof el.getBoundingClientRect == 'function') ? el.getBoundingClientRect() : null, {
      scroll: isBody ? document.documentElement.scrollTop || document.body.scrollTop : $element.scrollTop(),
      width:  isBody ? $(window).width()  : $element.outerWidth(),
      height: isBody ? $(window).height() : $element.outerHeight()
    }, isBody ? { top: 0, left: 0 } : $element.offset())
  }

  Tooltip.prototype.getCalculatedOffset = function (placement, pos, actualWidth, actualHeight) {
    return placement == 'bottom' ? { top: pos.top + pos.height,   left: pos.left + pos.width / 2 - actualWidth / 2  } :
           placement == 'top'    ? { top: pos.top - actualHeight, left: pos.left + pos.width / 2 - actualWidth / 2  } :
           placement == 'left'   ? { top: pos.top + pos.height / 2 - actualHeight / 2, left: pos.left - actualWidth } :
        /* placement == 'right' */ { top: pos.top + pos.height / 2 - actualHeight / 2, left: pos.left + pos.width   }

  }

  Tooltip.prototype.getViewportAdjustedDelta = function (placement, pos, actualWidth, actualHeight) {
    var delta = { top: 0, left: 0 }
    if (!this.$viewport) return delta

    var viewportPadding = this.options.viewport && this.options.viewport.padding || 0
    var viewportDimensions = this.getPosition(this.$viewport)

    if (/right|left/.test(placement)) {
      var topEdgeOffset    = pos.top - viewportPadding - viewportDimensions.scroll
      var bottomEdgeOffset = pos.top + viewportPadding - viewportDimensions.scroll + actualHeight
      if (topEdgeOffset < viewportDimensions.top) { // top overflow
        delta.top = viewportDimensions.top - topEdgeOffset
      } else if (bottomEdgeOffset > viewportDimensions.top + viewportDimensions.height) { // bottom overflow
        delta.top = viewportDimensions.top + viewportDimensions.height - bottomEdgeOffset
      }
    } else {
      var leftEdgeOffset  = pos.left - viewportPadding
      var rightEdgeOffset = pos.left + viewportPadding + actualWidth
      if (leftEdgeOffset < viewportDimensions.left) { // left overflow
        delta.left = viewportDimensions.left - leftEdgeOffset
      } else if (rightEdgeOffset > viewportDimensions.width) { // right overflow
        delta.left = viewportDimensions.left + viewportDimensions.width - rightEdgeOffset
      }
    }

    return delta
  }

  Tooltip.prototype.getTitle = function () {
    var title
    var $e = this.$element
    var o  = this.options

    title = $e.attr('data-original-title')
      || (typeof o.title == 'function' ? o.title.call($e[0]) :  o.title)

    return title
  }

  Tooltip.prototype.getUID = function (prefix) {
    do prefix += ~~(Math.random() * 1000000)
    while (document.getElementById(prefix))
    return prefix
  }

  Tooltip.prototype.tip = function () {
    return (this.$tip = this.$tip || $(this.options.template))
  }

  Tooltip.prototype.arrow = function () {
    return (this.$arrow = this.$arrow || this.tip().find('.tooltip-arrow'))
  }

  Tooltip.prototype.validate = function () {
    if (!this.$element[0].parentNode) {
      this.hide()
      this.$element = null
      this.options  = null
    }
  }

  Tooltip.prototype.enable = function () {
    this.enabled = true
  }

  Tooltip.prototype.disable = function () {
    this.enabled = false
  }

  Tooltip.prototype.toggleEnabled = function () {
    this.enabled = !this.enabled
  }

  Tooltip.prototype.toggle = function (e) {
    var self = this
    if (e) {
      self = $(e.currentTarget).data('bs.' + this.type)
      if (!self) {
        self = new this.constructor(e.currentTarget, this.getDelegateOptions())
        $(e.currentTarget).data('bs.' + this.type, self)
      }
    }

    self.tip().hasClass('in') ? self.leave(self) : self.enter(self)
  }

  Tooltip.prototype.destroy = function () {
    clearTimeout(this.timeout)
    this.hide().$element.off('.' + this.type).removeData('bs.' + this.type)
  }


  // TOOLTIP PLUGIN DEFINITION
  // =========================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.tooltip')
      var options = typeof option == 'object' && option

      if (!data && option == 'destroy') return
      if (!data) $this.data('bs.tooltip', (data = new Tooltip(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  var old = $.fn.tooltip

  $.fn.tooltip             = Plugin
  $.fn.tooltip.Constructor = Tooltip


  // TOOLTIP NO CONFLICT
  // ===================

  $.fn.tooltip.noConflict = function () {
    $.fn.tooltip = old
    return this
  }

}(jQuery);

/* ========================================================================
 * Bootstrap: popover.js v3.2.0
 * http://getbootstrap.com/javascript/#popovers
 * ========================================================================
 * Copyright 2011-2014 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // POPOVER PUBLIC CLASS DEFINITION
  // ===============================

  var Popover = function (element, options) {
    this.init('popover', element, options)
  }

  if (!$.fn.tooltip) throw new Error('Popover requires tooltip.js')

  Popover.VERSION  = '3.2.0'

  Popover.DEFAULTS = $.extend({}, $.fn.tooltip.Constructor.DEFAULTS, {
    placement: 'right',
    trigger: 'click',
    content: '',
    template: '<div class="popover" role="tooltip"><div class="arrow"></div><h3 class="popover-title"></h3><div class="popover-content"></div></div>'
  })


  // NOTE: POPOVER EXTENDS tooltip.js
  // ================================

  Popover.prototype = $.extend({}, $.fn.tooltip.Constructor.prototype)

  Popover.prototype.constructor = Popover

  Popover.prototype.getDefaults = function () {
    return Popover.DEFAULTS
  }

  Popover.prototype.setContent = function () {
    var $tip    = this.tip()
    var title   = this.getTitle()
    var content = this.getContent()

    $tip.find('.popover-title')[this.options.html ? 'html' : 'text'](title)
    $tip.find('.popover-content').empty()[ // we use append for html objects to maintain js events
      this.options.html ? (typeof content == 'string' ? 'html' : 'append') : 'text'
    ](content)

    $tip.removeClass('fade top bottom left right in')

    // IE8 doesn't accept hiding via the `:empty` pseudo selector, we have to do
    // this manually by checking the contents.
    if (!$tip.find('.popover-title').html()) $tip.find('.popover-title').hide()
  }

  Popover.prototype.hasContent = function () {
    return this.getTitle() || this.getContent()
  }

  Popover.prototype.getContent = function () {
    var $e = this.$element
    var o  = this.options

    return $e.attr('data-content')
      || (typeof o.content == 'function' ?
            o.content.call($e[0]) :
            o.content)
  }

  Popover.prototype.arrow = function () {
    return (this.$arrow = this.$arrow || this.tip().find('.arrow'))
  }

  Popover.prototype.tip = function () {
    if (!this.$tip) this.$tip = $(this.options.template)
    return this.$tip
  }


  // POPOVER PLUGIN DEFINITION
  // =========================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.popover')
      var options = typeof option == 'object' && option

      if (!data && option == 'destroy') return
      if (!data) $this.data('bs.popover', (data = new Popover(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  var old = $.fn.popover

  $.fn.popover             = Plugin
  $.fn.popover.Constructor = Popover


  // POPOVER NO CONFLICT
  // ===================

  $.fn.popover.noConflict = function () {
    $.fn.popover = old
    return this
  }

}(jQuery);


/*
 * angular-ui-bootstrap
 * http://angular-ui.github.io/bootstrap/

 * Version: 0.11.0 - 2014-05-01
 * License: MIT
 */
angular.module("ui.bootstrap", ["ui.bootstrap.tpls", "ui.bootstrap.transition","ui.bootstrap.collapse","ui.bootstrap.accordion","ui.bootstrap.alert","ui.bootstrap.bindHtml","ui.bootstrap.buttons","ui.bootstrap.carousel","ui.bootstrap.dateparser","ui.bootstrap.position","ui.bootstrap.datepicker","ui.bootstrap.dropdown","ui.bootstrap.modal","ui.bootstrap.pagination","ui.bootstrap.tooltip","ui.bootstrap.popover","ui.bootstrap.progressbar","ui.bootstrap.rating","ui.bootstrap.tabs","ui.bootstrap.timepicker","ui.bootstrap.typeahead"]);
angular.module("ui.bootstrap.tpls", ["template/accordion/accordion-group.html","template/accordion/accordion.html","template/alert/alert.html","template/carousel/carousel.html","template/carousel/slide.html","template/datepicker/datepicker.html","template/datepicker/day.html","template/datepicker/month.html","template/datepicker/popup.html","template/datepicker/year.html","template/modal/backdrop.html","template/modal/window.html","template/pagination/pager.html","template/pagination/pagination.html","template/tooltip/tooltip-html-unsafe-popup.html","template/tooltip/tooltip-popup.html","template/popover/popover.html","template/progressbar/bar.html","template/progressbar/progress.html","template/progressbar/progressbar.html","template/rating/rating.html","template/tabs/tab.html","template/tabs/tabset.html","template/timepicker/timepicker.html","template/typeahead/typeahead-match.html","template/typeahead/typeahead-popup.html"]);
angular.module('ui.bootstrap.transition', [])

/**
 * $transition service provides a consistent interface to trigger CSS 3 transitions and to be informed when they complete.
 * @param  {DOMElement} element  The DOMElement that will be animated.
 * @param  {string|object|function} trigger  The thing that will cause the transition to start:
 *   - As a string, it represents the css class to be added to the element.
 *   - As an object, it represents a hash of style attributes to be applied to the element.
 *   - As a function, it represents a function to be called that will cause the transition to occur.
 * @return {Promise}  A promise that is resolved when the transition finishes.
 */
.factory('$transition', ['$q', '$timeout', '$rootScope', function($q, $timeout, $rootScope) {

  var $transition = function(element, trigger, options) {
    options = options || {};
    var deferred = $q.defer();
    var endEventName = $transition[options.animation ? 'animationEndEventName' : 'transitionEndEventName'];

    var transitionEndHandler = function(event) {
      $rootScope.$apply(function() {
        element.unbind(endEventName, transitionEndHandler);
        deferred.resolve(element);
      });
    };

    if (endEventName) {
      element.bind(endEventName, transitionEndHandler);
    }

    // Wrap in a timeout to allow the browser time to update the DOM before the transition is to occur
    $timeout(function() {
      if ( angular.isString(trigger) ) {
        element.addClass(trigger);
      } else if ( angular.isFunction(trigger) ) {
        trigger(element);
      } else if ( angular.isObject(trigger) ) {
        element.css(trigger);
      }
      //If browser does not support transitions, instantly resolve
      if ( !endEventName ) {
        deferred.resolve(element);
      }
    });

    // Add our custom cancel function to the promise that is returned
    // We can call this if we are about to run a new transition, which we know will prevent this transition from ending,
    // i.e. it will therefore never raise a transitionEnd event for that transition
    deferred.promise.cancel = function() {
      if ( endEventName ) {
        element.unbind(endEventName, transitionEndHandler);
      }
      deferred.reject('Transition cancelled');
    };

    return deferred.promise;
  };

  // Work out the name of the transitionEnd event
  var transElement = document.createElement('trans');
  var transitionEndEventNames = {
    'WebkitTransition': 'webkitTransitionEnd',
    'MozTransition': 'transitionend',
    'OTransition': 'oTransitionEnd',
    'transition': 'transitionend'
  };
  var animationEndEventNames = {
    'WebkitTransition': 'webkitAnimationEnd',
    'MozTransition': 'animationend',
    'OTransition': 'oAnimationEnd',
    'transition': 'animationend'
  };
  function findEndEventName(endEventNames) {
    for (var name in endEventNames){
      if (transElement.style[name] !== undefined) {
        return endEventNames[name];
      }
    }
  }
  $transition.transitionEndEventName = findEndEventName(transitionEndEventNames);
  $transition.animationEndEventName = findEndEventName(animationEndEventNames);
  return $transition;
}]);

angular.module('ui.bootstrap.collapse', ['ui.bootstrap.transition'])

  .directive('collapse', ['$transition', function ($transition) {

    return {
      link: function (scope, element, attrs) {

        var initialAnimSkip = true;
        var currentTransition;

        function doTransition(change) {
          var newTransition = $transition(element, change);
          if (currentTransition) {
            currentTransition.cancel();
          }
          currentTransition = newTransition;
          newTransition.then(newTransitionDone, newTransitionDone);
          return newTransition;

          function newTransitionDone() {
            // Make sure it's this transition, otherwise, leave it alone.
            if (currentTransition === newTransition) {
              currentTransition = undefined;
            }
          }
        }

        function expand() {
          if (initialAnimSkip) {
            initialAnimSkip = false;
            expandDone();
          } else {
            element.removeClass('collapse').addClass('collapsing');
            doTransition({ height: element[0].scrollHeight + 'px' }).then(expandDone);
          }
        }

        function expandDone() {
          element.removeClass('collapsing');
          element.addClass('collapse in');
          element.css({height: 'auto'});
        }

        function collapse() {
          if (initialAnimSkip) {
            initialAnimSkip = false;
            collapseDone();
            element.css({height: 0});
          } else {
            // CSS transitions don't work with height: auto, so we have to manually change the height to a specific value
            element.css({ height: element[0].scrollHeight + 'px' });
            //trigger reflow so a browser realizes that height was updated from auto to a specific value
            var x = element[0].offsetWidth;

            element.removeClass('collapse in').addClass('collapsing');

            doTransition({ height: 0 }).then(collapseDone);
          }
        }

        function collapseDone() {
          element.removeClass('collapsing');
          element.addClass('collapse');
        }

        scope.$watch(attrs.collapse, function (shouldCollapse) {
          if (shouldCollapse) {
            collapse();
          } else {
            expand();
          }
        });
      }
    };
  }]);

angular.module('ui.bootstrap.accordion', ['ui.bootstrap.collapse'])

.constant('accordionConfig', {
  closeOthers: true
})

.controller('AccordionController', ['$scope', '$attrs', 'accordionConfig', function ($scope, $attrs, accordionConfig) {

  // This array keeps track of the accordion groups
  this.groups = [];

  // Ensure that all the groups in this accordion are closed, unless close-others explicitly says not to
  this.closeOthers = function(openGroup) {
    var closeOthers = angular.isDefined($attrs.closeOthers) ? $scope.$eval($attrs.closeOthers) : accordionConfig.closeOthers;
    if ( closeOthers ) {
      angular.forEach(this.groups, function (group) {
        if ( group !== openGroup ) {
          group.isOpen = false;
        }
      });
    }
  };

  // This is called from the accordion-group directive to add itself to the accordion
  this.addGroup = function(groupScope) {
    var that = this;
    this.groups.push(groupScope);

    groupScope.$on('$destroy', function (event) {
      that.removeGroup(groupScope);
    });
  };

  // This is called from the accordion-group directive when to remove itself
  this.removeGroup = function(group) {
    var index = this.groups.indexOf(group);
    if ( index !== -1 ) {
      this.groups.splice(index, 1);
    }
  };

}])

// The accordion directive simply sets up the directive controller
// and adds an accordion CSS class to itself element.
.directive('accordion', function () {
  return {
    restrict:'EA',
    controller:'AccordionController',
    transclude: true,
    replace: false,
    templateUrl: 'template/accordion/accordion.html'
  };
})

// The accordion-group directive indicates a block of html that will expand and collapse in an accordion
.directive('accordionGroup', function() {
  return {
    require:'^accordion',         // We need this directive to be inside an accordion
    restrict:'EA',
    transclude:true,              // It transcludes the contents of the directive into the template
    replace: true,                // The element containing the directive will be replaced with the template
    templateUrl:'template/accordion/accordion-group.html',
    scope: {
      heading: '@',               // Interpolate the heading attribute onto this scope
      isOpen: '=?',
      isDisabled: '=?'
    },
    controller: function() {
      this.setHeading = function(element) {
        this.heading = element;
      };
    },
    link: function(scope, element, attrs, accordionCtrl) {
      accordionCtrl.addGroup(scope);

      scope.$watch('isOpen', function(value) {
        if ( value ) {
          accordionCtrl.closeOthers(scope);
        }
      });

      scope.toggleOpen = function() {
        if ( !scope.isDisabled ) {
          scope.isOpen = !scope.isOpen;
        }
      };
    }
  };
})

// Use accordion-heading below an accordion-group to provide a heading containing HTML
// <accordion-group>
//   <accordion-heading>Heading containing HTML - <img src="..."></accordion-heading>
// </accordion-group>
.directive('accordionHeading', function() {
  return {
    restrict: 'EA',
    transclude: true,   // Grab the contents to be used as the heading
    template: '',       // In effect remove this element!
    replace: true,
    require: '^accordionGroup',
    link: function(scope, element, attr, accordionGroupCtrl, transclude) {
      // Pass the heading to the accordion-group controller
      // so that it can be transcluded into the right place in the template
      // [The second parameter to transclude causes the elements to be cloned so that they work in ng-repeat]
      accordionGroupCtrl.setHeading(transclude(scope, function() {}));
    }
  };
})

// Use in the accordion-group template to indicate where you want the heading to be transcluded
// You must provide the property on the accordion-group controller that will hold the transcluded element
// <div class="accordion-group">
//   <div class="accordion-heading" ><a ... accordion-transclude="heading">...</a></div>
//   ...
// </div>
.directive('accordionTransclude', function() {
  return {
    require: '^accordionGroup',
    link: function(scope, element, attr, controller) {
      scope.$watch(function() { return controller[attr.accordionTransclude]; }, function(heading) {
        if ( heading ) {
          element.html('');
          element.append(heading);
        }
      });
    }
  };
});

angular.module('ui.bootstrap.alert', [])

.controller('AlertController', ['$scope', '$attrs', function ($scope, $attrs) {
  $scope.closeable = 'close' in $attrs;
}])

.directive('alert', function () {
  return {
    restrict:'EA',
    controller:'AlertController',
    templateUrl:'template/alert/alert.html',
    transclude:true,
    replace:true,
    scope: {
      type: '@',
      close: '&'
    }
  };
});

angular.module('ui.bootstrap.bindHtml', [])

  .directive('bindHtmlUnsafe', function () {
    return function (scope, element, attr) {
      element.addClass('ng-binding').data('$binding', attr.bindHtmlUnsafe);
      scope.$watch(attr.bindHtmlUnsafe, function bindHtmlUnsafeWatchAction(value) {
        element.html(value || '');
      });
    };
  });
angular.module('ui.bootstrap.buttons', [])

.constant('buttonConfig', {
  activeClass: 'active',
  toggleEvent: 'click'
})

.controller('ButtonsController', ['buttonConfig', function(buttonConfig) {
  this.activeClass = buttonConfig.activeClass || 'active';
  this.toggleEvent = buttonConfig.toggleEvent || 'click';
}])

.directive('btnRadio', function () {
  return {
    require: ['btnRadio', 'ngModel'],
    controller: 'ButtonsController',
    link: function (scope, element, attrs, ctrls) {
      var buttonsCtrl = ctrls[0], ngModelCtrl = ctrls[1];

      //model -> UI
      ngModelCtrl.$render = function () {
        element.toggleClass(buttonsCtrl.activeClass, angular.equals(ngModelCtrl.$modelValue, scope.$eval(attrs.btnRadio)));
      };

      //ui->model
      element.bind(buttonsCtrl.toggleEvent, function () {
        var isActive = element.hasClass(buttonsCtrl.activeClass);

        if (!isActive || angular.isDefined(attrs.uncheckable)) {
          scope.$apply(function () {
            ngModelCtrl.$setViewValue(isActive ? null : scope.$eval(attrs.btnRadio));
            ngModelCtrl.$render();
          });
        }
      });
    }
  };
})

.directive('btnCheckbox', function () {
  return {
    require: ['btnCheckbox', 'ngModel'],
    controller: 'ButtonsController',
    link: function (scope, element, attrs, ctrls) {
      var buttonsCtrl = ctrls[0], ngModelCtrl = ctrls[1];

      function getTrueValue() {
        return getCheckboxValue(attrs.btnCheckboxTrue, true);
      }

      function getFalseValue() {
        return getCheckboxValue(attrs.btnCheckboxFalse, false);
      }

      function getCheckboxValue(attributeValue, defaultValue) {
        var val = scope.$eval(attributeValue);
        return angular.isDefined(val) ? val : defaultValue;
      }

      //model -> UI
      ngModelCtrl.$render = function () {
        element.toggleClass(buttonsCtrl.activeClass, angular.equals(ngModelCtrl.$modelValue, getTrueValue()));
      };

      //ui->model
      element.bind(buttonsCtrl.toggleEvent, function () {
        scope.$apply(function () {
          ngModelCtrl.$setViewValue(element.hasClass(buttonsCtrl.activeClass) ? getFalseValue() : getTrueValue());
          ngModelCtrl.$render();
        });
      });
    }
  };
});

/**
* @ngdoc overview
* @name ui.bootstrap.carousel
*
* @description
* AngularJS version of an image carousel.
*
*/
angular.module('ui.bootstrap.carousel', ['ui.bootstrap.transition'])
.controller('CarouselController', ['$scope', '$timeout', '$transition', function ($scope, $timeout, $transition) {
  var self = this,
    slides = self.slides = $scope.slides = [],
    currentIndex = -1,
    currentTimeout, isPlaying;
  self.currentSlide = null;

  var destroyed = false;
  /* direction: "prev" or "next" */
  self.select = $scope.select = function(nextSlide, direction) {
    var nextIndex = slides.indexOf(nextSlide);
    //Decide direction if it's not given
    if (direction === undefined) {
      direction = nextIndex > currentIndex ? 'next' : 'prev';
    }
    if (nextSlide && nextSlide !== self.currentSlide) {
      if ($scope.$currentTransition) {
        $scope.$currentTransition.cancel();
        //Timeout so ng-class in template has time to fix classes for finished slide
        $timeout(goNext);
      } else {
        goNext();
      }
    }
    function goNext() {
      // Scope has been destroyed, stop here.
      if (destroyed) { return; }
      //If we have a slide to transition from and we have a transition type and we're allowed, go
      if (self.currentSlide && angular.isString(direction) && !$scope.noTransition && nextSlide.$element) {
        //We shouldn't do class manip in here, but it's the same weird thing bootstrap does. need to fix sometime
        nextSlide.$element.addClass(direction);
        var reflow = nextSlide.$element[0].offsetWidth; //force reflow

        //Set all other slides to stop doing their stuff for the new transition
        angular.forEach(slides, function(slide) {
          angular.extend(slide, {direction: '', entering: false, leaving: false, active: false});
        });
        angular.extend(nextSlide, {direction: direction, active: true, entering: true});
        angular.extend(self.currentSlide||{}, {direction: direction, leaving: true});

        $scope.$currentTransition = $transition(nextSlide.$element, {});
        //We have to create new pointers inside a closure since next & current will change
        (function(next,current) {
          $scope.$currentTransition.then(
            function(){ transitionDone(next, current); },
            function(){ transitionDone(next, current); }
          );
        }(nextSlide, self.currentSlide));
      } else {
        transitionDone(nextSlide, self.currentSlide);
      }
      self.currentSlide = nextSlide;
      currentIndex = nextIndex;
      //every time you change slides, reset the timer
      restartTimer();
    }
    function transitionDone(next, current) {
      angular.extend(next, {direction: '', active: true, leaving: false, entering: false});
      angular.extend(current||{}, {direction: '', active: false, leaving: false, entering: false});
      $scope.$currentTransition = null;
    }
  };
  $scope.$on('$destroy', function () {
    destroyed = true;
  });

  /* Allow outside people to call indexOf on slides array */
  self.indexOfSlide = function(slide) {
    return slides.indexOf(slide);
  };

  $scope.next = function() {
    var newIndex = (currentIndex + 1) % slides.length;

    //Prevent this user-triggered transition from occurring if there is already one in progress
    if (!$scope.$currentTransition) {
      return self.select(slides[newIndex], 'next');
    }
  };

  $scope.prev = function() {
    var newIndex = currentIndex - 1 < 0 ? slides.length - 1 : currentIndex - 1;

    //Prevent this user-triggered transition from occurring if there is already one in progress
    if (!$scope.$currentTransition) {
      return self.select(slides[newIndex], 'prev');
    }
  };

  $scope.isActive = function(slide) {
     return self.currentSlide === slide;
  };

  $scope.$watch('interval', restartTimer);
  $scope.$on('$destroy', resetTimer);

  function restartTimer() {
    resetTimer();
    var interval = +$scope.interval;
    if (!isNaN(interval) && interval>=0) {
      currentTimeout = $timeout(timerFn, interval);
    }
  }

  function resetTimer() {
    if (currentTimeout) {
      $timeout.cancel(currentTimeout);
      currentTimeout = null;
    }
  }

  function timerFn() {
    if (isPlaying) {
      $scope.next();
      restartTimer();
    } else {
      $scope.pause();
    }
  }

  $scope.play = function() {
    if (!isPlaying) {
      isPlaying = true;
      restartTimer();
    }
  };
  $scope.pause = function() {
    if (!$scope.noPause) {
      isPlaying = false;
      resetTimer();
    }
  };

  self.addSlide = function(slide, element) {
    slide.$element = element;
    slides.push(slide);
    //if this is the first slide or the slide is set to active, select it
    if(slides.length === 1 || slide.active) {
      self.select(slides[slides.length-1]);
      if (slides.length == 1) {
        $scope.play();
      }
    } else {
      slide.active = false;
    }
  };

  self.removeSlide = function(slide) {
    //get the index of the slide inside the carousel
    var index = slides.indexOf(slide);
    slides.splice(index, 1);
    if (slides.length > 0 && slide.active) {
      if (index >= slides.length) {
        self.select(slides[index-1]);
      } else {
        self.select(slides[index]);
      }
    } else if (currentIndex > index) {
      currentIndex--;
    }
  };

}])

/**
 * @ngdoc directive
 * @name ui.bootstrap.carousel.directive:carousel
 * @restrict EA
 *
 * @description
 * Carousel is the outer container for a set of image 'slides' to showcase.
 *
 * @param {number=} interval The time, in milliseconds, that it will take the carousel to go to the next slide.
 * @param {boolean=} noTransition Whether to disable transitions on the carousel.
 * @param {boolean=} noPause Whether to disable pausing on the carousel (by default, the carousel interval pauses on hover).
 *
 * @example
<example module="ui.bootstrap">
  <file name="index.html">
    <carousel>
      <slide>
        <img src="http://placekitten.com/150/150" style="margin:auto;">
        <div class="carousel-caption">
          <p>Beautiful!</p>
        </div>
      </slide>
      <slide>
        <img src="http://placekitten.com/100/150" style="margin:auto;">
        <div class="carousel-caption">
          <p>D'aww!</p>
        </div>
      </slide>
    </carousel>
  </file>
  <file name="demo.css">
    .carousel-indicators {
      top: auto;
      bottom: 15px;
    }
  </file>
</example>
 */
.directive('carousel', [function() {
  return {
    restrict: 'EA',
    transclude: true,
    replace: true,
    controller: 'CarouselController',
    require: 'carousel',
    templateUrl: 'template/carousel/carousel.html',
    scope: {
      interval: '=',
      noTransition: '=',
      noPause: '='
    }
  };
}])

/**
 * @ngdoc directive
 * @name ui.bootstrap.carousel.directive:slide
 * @restrict EA
 *
 * @description
 * Creates a slide inside a {@link ui.bootstrap.carousel.directive:carousel carousel}.  Must be placed as a child of a carousel element.
 *
 * @param {boolean=} active Model binding, whether or not this slide is currently active.
 *
 * @example
<example module="ui.bootstrap">
  <file name="index.html">
<div ng-controller="CarouselDemoCtrl">
  <carousel>
    <slide ng-repeat="slide in slides" active="slide.active">
      <img ng-src="{{slide.image}}" style="margin:auto;">
      <div class="carousel-caption">
        <h4>Slide {{$index}}</h4>
        <p>{{slide.text}}</p>
      </div>
    </slide>
  </carousel>
  Interval, in milliseconds: <input type="number" ng-model="myInterval">
  <br />Enter a negative number to stop the interval.
</div>
  </file>
  <file name="script.js">
function CarouselDemoCtrl($scope) {
  $scope.myInterval = 5000;
}
  </file>
  <file name="demo.css">
    .carousel-indicators {
      top: auto;
      bottom: 15px;
    }
  </file>
</example>
*/

.directive('slide', function() {
  return {
    require: '^carousel',
    restrict: 'EA',
    transclude: true,
    replace: true,
    templateUrl: 'template/carousel/slide.html',
    scope: {
      active: '=?'
    },
    link: function (scope, element, attrs, carouselCtrl) {
      carouselCtrl.addSlide(scope, element);
      //when the scope is destroyed then remove the slide from the current slides array
      scope.$on('$destroy', function() {
        carouselCtrl.removeSlide(scope);
      });

      scope.$watch('active', function(active) {
        if (active) {
          carouselCtrl.select(scope);
        }
      });
    }
  };
});

angular.module('ui.bootstrap.dateparser', [])

.service('dateParser', ['$locale', 'orderByFilter', function($locale, orderByFilter) {

  this.parsers = {};

  var formatCodeToRegex = {
    'yyyy': {
      regex: '\\d{4}',
      apply: function(value) { this.year = +value; }
    },
    'yy': {
      regex: '\\d{2}',
      apply: function(value) { this.year = +value + 2000; }
    },
    'y': {
      regex: '\\d{1,4}',
      apply: function(value) { this.year = +value; }
    },
    'MMMM': {
      regex: $locale.DATETIME_FORMATS.MONTH.join('|'),
      apply: function(value) { this.month = $locale.DATETIME_FORMATS.MONTH.indexOf(value); }
    },
    'MMM': {
      regex: $locale.DATETIME_FORMATS.SHORTMONTH.join('|'),
      apply: function(value) { this.month = $locale.DATETIME_FORMATS.SHORTMONTH.indexOf(value); }
    },
    'MM': {
      regex: '0[1-9]|1[0-2]',
      apply: function(value) { this.month = value - 1; }
    },
    'M': {
      regex: '[1-9]|1[0-2]',
      apply: function(value) { this.month = value - 1; }
    },
    'dd': {
      regex: '[0-2][0-9]{1}|3[0-1]{1}',
      apply: function(value) { this.date = +value; }
    },
    'd': {
      regex: '[1-2]?[0-9]{1}|3[0-1]{1}',
      apply: function(value) { this.date = +value; }
    },
    'EEEE': {
      regex: $locale.DATETIME_FORMATS.DAY.join('|')
    },
    'EEE': {
      regex: $locale.DATETIME_FORMATS.SHORTDAY.join('|')
    }
  };

  this.createParser = function(format) {
    var map = [], regex = format.split('');

    angular.forEach(formatCodeToRegex, function(data, code) {
      var index = format.indexOf(code);

      if (index > -1) {
        format = format.split('');

        regex[index] = '(' + data.regex + ')';
        format[index] = '$'; // Custom symbol to define consumed part of format
        for (var i = index + 1, n = index + code.length; i < n; i++) {
          regex[i] = '';
          format[i] = '$';
        }
        format = format.join('');

        map.push({ index: index, apply: data.apply });
      }
    });

    return {
      regex: new RegExp('^' + regex.join('') + '$'),
      map: orderByFilter(map, 'index')
    };
  };

  this.parse = function(input, format) {
    if ( !angular.isString(input) ) {
      return input;
    }

    format = $locale.DATETIME_FORMATS[format] || format;

    if ( !this.parsers[format] ) {
      this.parsers[format] = this.createParser(format);
    }

    var parser = this.parsers[format],
        regex = parser.regex,
        map = parser.map,
        results = input.match(regex);

    if ( results && results.length ) {
      var fields = { year: 1900, month: 0, date: 1, hours: 0 }, dt;

      for( var i = 1, n = results.length; i < n; i++ ) {
        var mapper = map[i-1];
        if ( mapper.apply ) {
          mapper.apply.call(fields, results[i]);
        }
      }

      if ( isValid(fields.year, fields.month, fields.date) ) {
        dt = new Date( fields.year, fields.month, fields.date, fields.hours);
      }

      return dt;
    }
  };

  // Check if date is valid for specific month (and year for February).
  // Month: 0 = Jan, 1 = Feb, etc
  function isValid(year, month, date) {
    if ( month === 1 && date > 28) {
        return date === 29 && ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0);
    }

    if ( month === 3 || month === 5 || month === 8 || month === 10) {
        return date < 31;
    }

    return true;
  }
}]);

angular.module('ui.bootstrap.position', [])

/**
 * A set of utility methods that can be use to retrieve position of DOM elements.
 * It is meant to be used where we need to absolute-position DOM elements in
 * relation to other, existing elements (this is the case for tooltips, popovers,
 * typeahead suggestions etc.).
 */
  .factory('$position', ['$document', '$window', function ($document, $window) {

    function getStyle(el, cssprop) {
      if (el.currentStyle) { //IE
        return el.currentStyle[cssprop];
      } else if ($window.getComputedStyle) {
        return $window.getComputedStyle(el)[cssprop];
      }
      // finally try and get inline style
      return el.style[cssprop];
    }

    /**
     * Checks if a given element is statically positioned
     * @param element - raw DOM element
     */
    function isStaticPositioned(element) {
      return (getStyle(element, 'position') || 'static' ) === 'static';
    }

    /**
     * returns the closest, non-statically positioned parentOffset of a given element
     * @param element
     */
    var parentOffsetEl = function (element) {
      var docDomEl = $document[0];
      var offsetParent = element.offsetParent || docDomEl;
      while (offsetParent && offsetParent !== docDomEl && isStaticPositioned(offsetParent) ) {
        offsetParent = offsetParent.offsetParent;
      }
      return offsetParent || docDomEl;
    };

    return {
      /**
       * Provides read-only equivalent of jQuery's position function:
       * http://api.jquery.com/position/
       */
      position: function (element) {
        var elBCR = this.offset(element);
        var offsetParentBCR = { top: 0, left: 0 };
        var offsetParentEl = parentOffsetEl(element[0]);
        if (offsetParentEl != $document[0]) {
          offsetParentBCR = this.offset(angular.element(offsetParentEl));
          offsetParentBCR.top += offsetParentEl.clientTop - offsetParentEl.scrollTop;
          offsetParentBCR.left += offsetParentEl.clientLeft - offsetParentEl.scrollLeft;
        }

        var boundingClientRect = element[0].getBoundingClientRect();
        return {
          width: boundingClientRect.width || element.prop('offsetWidth'),
          height: boundingClientRect.height || element.prop('offsetHeight'),
          top: elBCR.top - offsetParentBCR.top,
          left: elBCR.left - offsetParentBCR.left
        };
      },

      /**
       * Provides read-only equivalent of jQuery's offset function:
       * http://api.jquery.com/offset/
       */
      offset: function (element) {
        var boundingClientRect = element[0].getBoundingClientRect();
        return {
          width: boundingClientRect.width || element.prop('offsetWidth'),
          height: boundingClientRect.height || element.prop('offsetHeight'),
          top: boundingClientRect.top + ($window.pageYOffset || $document[0].documentElement.scrollTop),
          left: boundingClientRect.left + ($window.pageXOffset || $document[0].documentElement.scrollLeft)
        };
      },

      /**
       * Provides coordinates for the targetEl in relation to hostEl
       */
      positionElements: function (hostEl, targetEl, positionStr, appendToBody) {

        var positionStrParts = positionStr.split('-');
        var pos0 = positionStrParts[0], pos1 = positionStrParts[1] || 'center';

        var hostElPos,
          targetElWidth,
          targetElHeight,
          targetElPos;

        hostElPos = appendToBody ? this.offset(hostEl) : this.position(hostEl);

        targetElWidth = targetEl.prop('offsetWidth');
        targetElHeight = targetEl.prop('offsetHeight');

        var shiftWidth = {
          center: function () {
            return hostElPos.left + hostElPos.width / 2 - targetElWidth / 2;
          },
          left: function () {
            return hostElPos.left;
          },
          right: function () {
            return hostElPos.left + hostElPos.width;
          }
        };

        var shiftHeight = {
          center: function () {
            return hostElPos.top + hostElPos.height / 2 - targetElHeight / 2;
          },
          top: function () {
            return hostElPos.top;
          },
          bottom: function () {
            return hostElPos.top + hostElPos.height;
          }
        };

        switch (pos0) {
          case 'right':
            targetElPos = {
              top: shiftHeight[pos1](),
              left: shiftWidth[pos0]()
            };
            break;
          case 'left':
            targetElPos = {
              top: shiftHeight[pos1](),
              left: hostElPos.left - targetElWidth
            };
            break;
          case 'bottom':
            targetElPos = {
              top: shiftHeight[pos0](),
              left: shiftWidth[pos1]()
            };
            break;
          default:
            targetElPos = {
              top: hostElPos.top - targetElHeight,
              left: shiftWidth[pos1]()
            };
            break;
        }

        return targetElPos;
      }
    };
  }]);

angular.module('ui.bootstrap.datepicker', ['ui.bootstrap.dateparser', 'ui.bootstrap.position'])

.constant('datepickerConfig', {
  formatDay: 'dd',
  formatMonth: 'MMMM',
  formatYear: 'yyyy',
  formatDayHeader: 'EEE',
  formatDayTitle: 'MMMM yyyy',
  formatMonthTitle: 'yyyy',
  datepickerMode: 'day',
  minMode: 'day',
  maxMode: 'year',
  showWeeks: true,
  startingDay: 0,
  yearRange: 20,
  minDate: null,
  maxDate: null
})

.controller('DatepickerController', ['$scope', '$attrs', '$parse', '$interpolate', '$timeout', '$log', 'dateFilter', 'datepickerConfig', function($scope, $attrs, $parse, $interpolate, $timeout, $log, dateFilter, datepickerConfig) {
  var self = this,
      ngModelCtrl = { $setViewValue: angular.noop }; // nullModelCtrl;

  // Modes chain
  this.modes = ['day', 'month', 'year'];

  // Configuration attributes
  angular.forEach(['formatDay', 'formatMonth', 'formatYear', 'formatDayHeader', 'formatDayTitle', 'formatMonthTitle',
                   'minMode', 'maxMode', 'showWeeks', 'startingDay', 'yearRange'], function( key, index ) {
    self[key] = angular.isDefined($attrs[key]) ? (index < 8 ? $interpolate($attrs[key])($scope.$parent) : $scope.$parent.$eval($attrs[key])) : datepickerConfig[key];
  });

  // Watchable attributes
  angular.forEach(['minDate', 'maxDate'], function( key ) {
    if ( $attrs[key] ) {
      $scope.$parent.$watch($parse($attrs[key]), function(value) {
        self[key] = value ? new Date(value) : null;
        self.refreshView();
      });
    } else {
      self[key] = datepickerConfig[key] ? new Date(datepickerConfig[key]) : null;
    }
  });

  $scope.datepickerMode = $scope.datepickerMode || datepickerConfig.datepickerMode;
  $scope.uniqueId = 'datepicker-' + $scope.$id + '-' + Math.floor(Math.random() * 10000);
  this.activeDate = angular.isDefined($attrs.initDate) ? $scope.$parent.$eval($attrs.initDate) : new Date();

  $scope.isActive = function(dateObject) {
    if (self.compare(dateObject.date, self.activeDate) === 0) {
      $scope.activeDateId = dateObject.uid;
      return true;
    }
    return false;
  };

  this.init = function( ngModelCtrl_ ) {
    ngModelCtrl = ngModelCtrl_;

    ngModelCtrl.$render = function() {
      self.render();
    };
  };

  this.render = function() {
    if ( ngModelCtrl.$modelValue ) {
      var date = new Date( ngModelCtrl.$modelValue ),
          isValid = !isNaN(date);

      if ( isValid ) {
        this.activeDate = date;
      } else {
        $log.error('Datepicker directive: "ng-model" value must be a Date object, a number of milliseconds since 01.01.1970 or a string representing an RFC2822 or ISO 8601 date.');
      }
      ngModelCtrl.$setValidity('date', isValid);
    }
    this.refreshView();
  };

  this.refreshView = function() {
    if ( this.element ) {
      this._refreshView();

      var date = ngModelCtrl.$modelValue ? new Date(ngModelCtrl.$modelValue) : null;
      ngModelCtrl.$setValidity('date-disabled', !date || (this.element && !this.isDisabled(date)));
    }
  };

  this.createDateObject = function(date, format) {
    var model = ngModelCtrl.$modelValue ? new Date(ngModelCtrl.$modelValue) : null;
    return {
      date: date,
      label: dateFilter(date, format),
      selected: model && this.compare(date, model) === 0,
      disabled: this.isDisabled(date),
      current: this.compare(date, new Date()) === 0
    };
  };

  this.isDisabled = function( date ) {
    return ((this.minDate && this.compare(date, this.minDate) < 0) || (this.maxDate && this.compare(date, this.maxDate) > 0) || ($attrs.dateDisabled && $scope.dateDisabled({date: date, mode: $scope.datepickerMode})));
  };

  // Split array into smaller arrays
  this.split = function(arr, size) {
    var arrays = [];
    while (arr.length > 0) {
      arrays.push(arr.splice(0, size));
    }
    return arrays;
  };

  $scope.select = function( date ) {
    if ( $scope.datepickerMode === self.minMode ) {
      var dt = ngModelCtrl.$modelValue ? new Date( ngModelCtrl.$modelValue ) : new Date(0, 0, 0, 0, 0, 0, 0);
      dt.setFullYear( date.getFullYear(), date.getMonth(), date.getDate() );
      ngModelCtrl.$setViewValue( dt );
      ngModelCtrl.$render();
    } else {
      self.activeDate = date;
      $scope.datepickerMode = self.modes[ self.modes.indexOf( $scope.datepickerMode ) - 1 ];
    }
  };

  $scope.move = function( direction ) {
    var year = self.activeDate.getFullYear() + direction * (self.step.years || 0),
        month = self.activeDate.getMonth() + direction * (self.step.months || 0);
    self.activeDate.setFullYear(year, month, 1);
    self.refreshView();
  };

  $scope.toggleMode = function( direction ) {
    direction = direction || 1;

    if (($scope.datepickerMode === self.maxMode && direction === 1) || ($scope.datepickerMode === self.minMode && direction === -1)) {
      return;
    }

    $scope.datepickerMode = self.modes[ self.modes.indexOf( $scope.datepickerMode ) + direction ];
  };

  // Key event mapper
  $scope.keys = { 13:'enter', 32:'space', 33:'pageup', 34:'pagedown', 35:'end', 36:'home', 37:'left', 38:'up', 39:'right', 40:'down' };

  var focusElement = function() {
    $timeout(function() {
      self.element[0].focus();
    }, 0 , false);
  };

  // Listen for focus requests from popup directive
  $scope.$on('datepicker.focus', focusElement);

  $scope.keydown = function( evt ) {
    var key = $scope.keys[evt.which];

    if ( !key || evt.shiftKey || evt.altKey ) {
      return;
    }

    evt.preventDefault();
    evt.stopPropagation();

    if (key === 'enter' || key === 'space') {
      if ( self.isDisabled(self.activeDate)) {
        return; // do nothing
      }
      $scope.select(self.activeDate);
      focusElement();
    } else if (evt.ctrlKey && (key === 'up' || key === 'down')) {
      $scope.toggleMode(key === 'up' ? 1 : -1);
      focusElement();
    } else {
      self.handleKeyDown(key, evt);
      self.refreshView();
    }
  };
}])

.directive( 'datepicker', function () {
  return {
    restrict: 'EA',
    replace: true,
    templateUrl: 'template/datepicker/datepicker.html',
    scope: {
      datepickerMode: '=?',
      dateDisabled: '&'
    },
    require: ['datepicker', '?^ngModel'],
    controller: 'DatepickerController',
    link: function(scope, element, attrs, ctrls) {
      var datepickerCtrl = ctrls[0], ngModelCtrl = ctrls[1];

      if ( ngModelCtrl ) {
        datepickerCtrl.init( ngModelCtrl );
      }
    }
  };
})

.directive('daypicker', ['dateFilter', function (dateFilter) {
  return {
    restrict: 'EA',
    replace: true,
    templateUrl: 'template/datepicker/day.html',
    require: '^datepicker',
    link: function(scope, element, attrs, ctrl) {
      scope.showWeeks = ctrl.showWeeks;

      ctrl.step = { months: 1 };
      ctrl.element = element;

      var DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      function getDaysInMonth( year, month ) {
        return ((month === 1) && (year % 4 === 0) && ((year % 100 !== 0) || (year % 400 === 0))) ? 29 : DAYS_IN_MONTH[month];
      }

      function getDates(startDate, n) {
        var dates = new Array(n), current = new Date(startDate), i = 0;
        current.setHours(12); // Prevent repeated dates because of timezone bug
        while ( i < n ) {
          dates[i++] = new Date(current);
          current.setDate( current.getDate() + 1 );
        }
        return dates;
      }

      ctrl._refreshView = function() {
        var year = ctrl.activeDate.getFullYear(),
          month = ctrl.activeDate.getMonth(),
          firstDayOfMonth = new Date(year, month, 1),
          difference = ctrl.startingDay - firstDayOfMonth.getDay(),
          numDisplayedFromPreviousMonth = (difference > 0) ? 7 - difference : - difference,
          firstDate = new Date(firstDayOfMonth);

        if ( numDisplayedFromPreviousMonth > 0 ) {
          firstDate.setDate( - numDisplayedFromPreviousMonth + 1 );
        }

        // 42 is the number of days on a six-month calendar
        var days = getDates(firstDate, 42);
        for (var i = 0; i < 42; i ++) {
          days[i] = angular.extend(ctrl.createDateObject(days[i], ctrl.formatDay), {
            secondary: days[i].getMonth() !== month,
            uid: scope.uniqueId + '-' + i
          });
        }

        scope.labels = new Array(7);
        for (var j = 0; j < 7; j++) {
          scope.labels[j] = {
            abbr: dateFilter(days[j].date, ctrl.formatDayHeader),
            full: dateFilter(days[j].date, 'EEEE')
          };
        }

        scope.title = dateFilter(ctrl.activeDate, ctrl.formatDayTitle);
        scope.rows = ctrl.split(days, 7);

        if ( scope.showWeeks ) {
          scope.weekNumbers = [];
          var weekNumber = getISO8601WeekNumber( scope.rows[0][0].date ),
              numWeeks = scope.rows.length;
          while( scope.weekNumbers.push(weekNumber++) < numWeeks ) {}
        }
      };

      ctrl.compare = function(date1, date2) {
        return (new Date( date1.getFullYear(), date1.getMonth(), date1.getDate() ) - new Date( date2.getFullYear(), date2.getMonth(), date2.getDate() ) );
      };

      function getISO8601WeekNumber(date) {
        var checkDate = new Date(date);
        checkDate.setDate(checkDate.getDate() + 4 - (checkDate.getDay() || 7)); // Thursday
        var time = checkDate.getTime();
        checkDate.setMonth(0); // Compare with Jan 1
        checkDate.setDate(1);
        return Math.floor(Math.round((time - checkDate) / 86400000) / 7) + 1;
      }

      ctrl.handleKeyDown = function( key, evt ) {
        var date = ctrl.activeDate.getDate();

        if (key === 'left') {
          date = date - 1;   // up
        } else if (key === 'up') {
          date = date - 7;   // down
        } else if (key === 'right') {
          date = date + 1;   // down
        } else if (key === 'down') {
          date = date + 7;
        } else if (key === 'pageup' || key === 'pagedown') {
          var month = ctrl.activeDate.getMonth() + (key === 'pageup' ? - 1 : 1);
          ctrl.activeDate.setMonth(month, 1);
          date = Math.min(getDaysInMonth(ctrl.activeDate.getFullYear(), ctrl.activeDate.getMonth()), date);
        } else if (key === 'home') {
          date = 1;
        } else if (key === 'end') {
          date = getDaysInMonth(ctrl.activeDate.getFullYear(), ctrl.activeDate.getMonth());
        }
        ctrl.activeDate.setDate(date);
      };

      ctrl.refreshView();
    }
  };
}])

.directive('monthpicker', ['dateFilter', function (dateFilter) {
  return {
    restrict: 'EA',
    replace: true,
    templateUrl: 'template/datepicker/month.html',
    require: '^datepicker',
    link: function(scope, element, attrs, ctrl) {
      ctrl.step = { years: 1 };
      ctrl.element = element;

      ctrl._refreshView = function() {
        var months = new Array(12),
            year = ctrl.activeDate.getFullYear();

        for ( var i = 0; i < 12; i++ ) {
          months[i] = angular.extend(ctrl.createDateObject(new Date(year, i, 1), ctrl.formatMonth), {
            uid: scope.uniqueId + '-' + i
          });
        }

        scope.title = dateFilter(ctrl.activeDate, ctrl.formatMonthTitle);
        scope.rows = ctrl.split(months, 3);
      };

      ctrl.compare = function(date1, date2) {
        return new Date( date1.getFullYear(), date1.getMonth() ) - new Date( date2.getFullYear(), date2.getMonth() );
      };

      ctrl.handleKeyDown = function( key, evt ) {
        var date = ctrl.activeDate.getMonth();

        if (key === 'left') {
          date = date - 1;   // up
        } else if (key === 'up') {
          date = date - 3;   // down
        } else if (key === 'right') {
          date = date + 1;   // down
        } else if (key === 'down') {
          date = date + 3;
        } else if (key === 'pageup' || key === 'pagedown') {
          var year = ctrl.activeDate.getFullYear() + (key === 'pageup' ? - 1 : 1);
          ctrl.activeDate.setFullYear(year);
        } else if (key === 'home') {
          date = 0;
        } else if (key === 'end') {
          date = 11;
        }
        ctrl.activeDate.setMonth(date);
      };

      ctrl.refreshView();
    }
  };
}])

.directive('yearpicker', ['dateFilter', function (dateFilter) {
  return {
    restrict: 'EA',
    replace: true,
    templateUrl: 'template/datepicker/year.html',
    require: '^datepicker',
    link: function(scope, element, attrs, ctrl) {
      var range = ctrl.yearRange;

      ctrl.step = { years: range };
      ctrl.element = element;

      function getStartingYear( year ) {
        return parseInt((year - 1) / range, 10) * range + 1;
      }

      ctrl._refreshView = function() {
        var years = new Array(range);

        for ( var i = 0, start = getStartingYear(ctrl.activeDate.getFullYear()); i < range; i++ ) {
          years[i] = angular.extend(ctrl.createDateObject(new Date(start + i, 0, 1), ctrl.formatYear), {
            uid: scope.uniqueId + '-' + i
          });
        }

        scope.title = [years[0].label, years[range - 1].label].join(' - ');
        scope.rows = ctrl.split(years, 5);
      };

      ctrl.compare = function(date1, date2) {
        return date1.getFullYear() - date2.getFullYear();
      };

      ctrl.handleKeyDown = function( key, evt ) {
        var date = ctrl.activeDate.getFullYear();

        if (key === 'left') {
          date = date - 1;   // up
        } else if (key === 'up') {
          date = date - 5;   // down
        } else if (key === 'right') {
          date = date + 1;   // down
        } else if (key === 'down') {
          date = date + 5;
        } else if (key === 'pageup' || key === 'pagedown') {
          date += (key === 'pageup' ? - 1 : 1) * ctrl.step.years;
        } else if (key === 'home') {
          date = getStartingYear( ctrl.activeDate.getFullYear() );
        } else if (key === 'end') {
          date = getStartingYear( ctrl.activeDate.getFullYear() ) + range - 1;
        }
        ctrl.activeDate.setFullYear(date);
      };

      ctrl.refreshView();
    }
  };
}])

.constant('datepickerPopupConfig', {
  datepickerPopup: 'yyyy-MM-dd',
  currentText: 'Today',
  clearText: 'Clear',
  closeText: 'Done',
  closeOnDateSelection: true,
  appendToBody: false,
  showButtonBar: true
})

.directive('datepickerPopup', ['$compile', '$parse', '$document', '$position', 'dateFilter', 'dateParser', 'datepickerPopupConfig',
function ($compile, $parse, $document, $position, dateFilter, dateParser, datepickerPopupConfig) {
  return {
    restrict: 'EA',
    require: 'ngModel',
    scope: {
      isOpen: '=?',
      currentText: '@',
      clearText: '@',
      closeText: '@',
      dateDisabled: '&'
    },
    link: function(scope, element, attrs, ngModel) {
      var dateFormat,
          closeOnDateSelection = angular.isDefined(attrs.closeOnDateSelection) ? scope.$parent.$eval(attrs.closeOnDateSelection) : datepickerPopupConfig.closeOnDateSelection,
          appendToBody = angular.isDefined(attrs.datepickerAppendToBody) ? scope.$parent.$eval(attrs.datepickerAppendToBody) : datepickerPopupConfig.appendToBody;

      scope.showButtonBar = angular.isDefined(attrs.showButtonBar) ? scope.$parent.$eval(attrs.showButtonBar) : datepickerPopupConfig.showButtonBar;

      scope.getText = function( key ) {
        return scope[key + 'Text'] || datepickerPopupConfig[key + 'Text'];
      };

      attrs.$observe('datepickerPopup', function(value) {
          dateFormat = value || datepickerPopupConfig.datepickerPopup;
          ngModel.$render();
      });

      // popup element used to display calendar
      var popupEl = angular.element('<div datepicker-popup-wrap><div datepicker></div></div>');
      popupEl.attr({
        'ng-model': 'date',
        'ng-change': 'dateSelection()'
      });

      function cameltoDash( string ){
        return string.replace(/([A-Z])/g, function($1) { return '-' + $1.toLowerCase(); });
      }

      // datepicker element
      var datepickerEl = angular.element(popupEl.children()[0]);
      if ( attrs.datepickerOptions ) {
        angular.forEach(scope.$parent.$eval(attrs.datepickerOptions), function( value, option ) {
          datepickerEl.attr( cameltoDash(option), value );
        });
      }

      angular.forEach(['minDate', 'maxDate'], function( key ) {
        if ( attrs[key] ) {
          scope.$parent.$watch($parse(attrs[key]), function(value){
            scope[key] = value;
          });
          datepickerEl.attr(cameltoDash(key), key);
        }
      });
      if (attrs.dateDisabled) {
        datepickerEl.attr('date-disabled', 'dateDisabled({ date: date, mode: mode })');
      }

      function parseDate(viewValue) {
        if (!viewValue) {
          ngModel.$setValidity('date', true);
          return null;
        } else if (angular.isDate(viewValue) && !isNaN(viewValue)) {
          ngModel.$setValidity('date', true);
          return viewValue;
        } else if (angular.isString(viewValue)) {
          var date = dateParser.parse(viewValue, dateFormat) || new Date(viewValue);
          if (isNaN(date)) {
            ngModel.$setValidity('date', false);
            return undefined;
          } else {
            ngModel.$setValidity('date', true);
            return date;
          }
        } else {
          ngModel.$setValidity('date', false);
          return undefined;
        }
      }
      ngModel.$parsers.unshift(parseDate);

      // Inner change
      scope.dateSelection = function(dt) {
        if (angular.isDefined(dt)) {
          scope.date = dt;
        }
        ngModel.$setViewValue(scope.date);
        ngModel.$render();

        if ( closeOnDateSelection ) {
          scope.isOpen = false;
          element[0].focus();
        }
      };

      element.bind('input change keyup', function() {
        scope.$apply(function() {
          scope.date = ngModel.$modelValue;
        });
      });

      // Outter change
      ngModel.$render = function() {
        var date = ngModel.$viewValue ? dateFilter(ngModel.$viewValue, dateFormat) : '';
        element.val(date);
        scope.date = parseDate( ngModel.$modelValue );
      };

      var documentClickBind = function(event) {
        if (scope.isOpen && event.target !== element[0]) {
          scope.$apply(function() {
            scope.isOpen = false;
          });
        }
      };

      var keydown = function(evt, noApply) {
        scope.keydown(evt);
      };
      element.bind('keydown', keydown);

      scope.keydown = function(evt) {
        if (evt.which === 27) {
          evt.preventDefault();
          evt.stopPropagation();
          scope.close();
        } else if (evt.which === 40 && !scope.isOpen) {
          scope.isOpen = true;
        }
      };

      scope.$watch('isOpen', function(value) {
        if (value) {
          scope.$broadcast('datepicker.focus');
          scope.position = appendToBody ? $position.offset(element) : $position.position(element);
          scope.position.top = scope.position.top + element.prop('offsetHeight');

          $document.bind('click', documentClickBind);
        } else {
          $document.unbind('click', documentClickBind);
        }
      });

      scope.select = function( date ) {
        if (date === 'today') {
          var today = new Date();
          if (angular.isDate(ngModel.$modelValue)) {
            date = new Date(ngModel.$modelValue);
            date.setFullYear(today.getFullYear(), today.getMonth(), today.getDate());
          } else {
            date = new Date(today.setHours(0, 0, 0, 0));
          }
        }
        scope.dateSelection( date );
      };

      scope.close = function() {
        scope.isOpen = false;
        element[0].focus();
      };

      var $popup = $compile(popupEl)(scope);
      if ( appendToBody ) {
        $document.find('body').append($popup);
      } else {
        element.after($popup);
      }

      scope.$on('$destroy', function() {
        $popup.remove();
        element.unbind('keydown', keydown);
        $document.unbind('click', documentClickBind);
      });
    }
  };
}])

.directive('datepickerPopupWrap', function() {
  return {
    restrict:'EA',
    replace: true,
    transclude: true,
    templateUrl: 'template/datepicker/popup.html',
    link:function (scope, element, attrs) {
      element.bind('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
      });
    }
  };
});

angular.module('ui.bootstrap.dropdown', [])

.constant('dropdownConfig', {
  openClass: 'open'
})

.service('dropdownService', ['$document', function($document) {
  var openScope = null;

  this.open = function( dropdownScope ) {
    if ( !openScope ) {
      $document.bind('click', closeDropdown);
      $document.bind('keydown', escapeKeyBind);
    }

    if ( openScope && openScope !== dropdownScope ) {
        openScope.isOpen = false;
    }

    openScope = dropdownScope;
  };

  this.close = function( dropdownScope ) {
    if ( openScope === dropdownScope ) {
      openScope = null;
      $document.unbind('click', closeDropdown);
      $document.unbind('keydown', escapeKeyBind);
    }
  };

  var closeDropdown = function( evt ) {
    if (evt && evt.isDefaultPrevented()) {
        return;
    }

    openScope.$apply(function() {
      openScope.isOpen = false;
    });
  };

  var escapeKeyBind = function( evt ) {
    if ( evt.which === 27 ) {
      openScope.focusToggleElement();
      closeDropdown();
    }
  };
}])

.controller('DropdownController', ['$scope', '$attrs', '$parse', 'dropdownConfig', 'dropdownService', '$animate', function($scope, $attrs, $parse, dropdownConfig, dropdownService, $animate) {
  var self = this,
      scope = $scope.$new(), // create a child scope so we are not polluting original one
      openClass = dropdownConfig.openClass,
      getIsOpen,
      setIsOpen = angular.noop,
      toggleInvoker = $attrs.onToggle ? $parse($attrs.onToggle) : angular.noop;

  this.init = function( element ) {
    self.$element = element;

    if ( $attrs.isOpen ) {
      getIsOpen = $parse($attrs.isOpen);
      setIsOpen = getIsOpen.assign;

      $scope.$watch(getIsOpen, function(value) {
        scope.isOpen = !!value;
      });
    }
  };

  this.toggle = function( open ) {
    return scope.isOpen = arguments.length ? !!open : !scope.isOpen;
  };

  // Allow other directives to watch status
  this.isOpen = function() {
    return scope.isOpen;
  };

  scope.focusToggleElement = function() {
    if ( self.toggleElement ) {
      self.toggleElement[0].focus();
    }
  };

  scope.$watch('isOpen', function( isOpen, wasOpen ) {
    $animate[isOpen ? 'addClass' : 'removeClass'](self.$element, openClass);

    if ( isOpen ) {
      scope.focusToggleElement();
      dropdownService.open( scope );
    } else {
      dropdownService.close( scope );
    }

    setIsOpen($scope, isOpen);
    if (angular.isDefined(isOpen) && isOpen !== wasOpen) {
      toggleInvoker($scope, { open: !!isOpen });
    }
  });

  $scope.$on('$locationChangeSuccess', function() {
    scope.isOpen = false;
  });

  $scope.$on('$destroy', function() {
    scope.$destroy();
  });
}])

.directive('dropdown', function() {
  return {
    restrict: 'CA',
    controller: 'DropdownController',
    link: function(scope, element, attrs, dropdownCtrl) {
      dropdownCtrl.init( element );
    }
  };
})

.directive('dropdownToggle', function() {
  return {
    restrict: 'CA',
    require: '?^dropdown',
    link: function(scope, element, attrs, dropdownCtrl) {
      if ( !dropdownCtrl ) {
        return;
      }

      dropdownCtrl.toggleElement = element;

      var toggleDropdown = function(event) {
        event.preventDefault();

        if ( !element.hasClass('disabled') && !attrs.disabled ) {
          scope.$apply(function() {
            dropdownCtrl.toggle();
          });
        }
      };

      element.bind('click', toggleDropdown);

      // WAI-ARIA
      element.attr({ 'aria-haspopup': true, 'aria-expanded': false });
      scope.$watch(dropdownCtrl.isOpen, function( isOpen ) {
        element.attr('aria-expanded', !!isOpen);
      });

      scope.$on('$destroy', function() {
        element.unbind('click', toggleDropdown);
      });
    }
  };
});

angular.module('ui.bootstrap.modal', ['ui.bootstrap.transition'])

/**
 * A helper, internal data structure that acts as a map but also allows getting / removing
 * elements in the LIFO order
 */
  .factory('$$stackedMap', function () {
    return {
      createNew: function () {
        var stack = [];

        return {
          add: function (key, value) {
            stack.push({
              key: key,
              value: value
            });
          },
          get: function (key) {
            for (var i = 0; i < stack.length; i++) {
              if (key == stack[i].key) {
                return stack[i];
              }
            }
          },
          keys: function() {
            var keys = [];
            for (var i = 0; i < stack.length; i++) {
              keys.push(stack[i].key);
            }
            return keys;
          },
          top: function () {
            return stack[stack.length - 1];
          },
          remove: function (key) {
            var idx = -1;
            for (var i = 0; i < stack.length; i++) {
              if (key == stack[i].key) {
                idx = i;
                break;
              }
            }
            return stack.splice(idx, 1)[0];
          },
          removeTop: function () {
            return stack.splice(stack.length - 1, 1)[0];
          },
          length: function () {
            return stack.length;
          }
        };
      }
    };
  })

/**
 * A helper directive for the $modal service. It creates a backdrop element.
 */
  .directive('modalBackdrop', ['$timeout', function ($timeout) {
    return {
      restrict: 'EA',
      replace: true,
      templateUrl: 'template/modal/backdrop.html',
      link: function (scope) {

        scope.animate = false;

        //trigger CSS transitions
        $timeout(function () {
          scope.animate = true;
        });
      }
    };
  }])

  .directive('modalWindow', ['$modalStack', '$timeout', function ($modalStack, $timeout) {
    return {
      restrict: 'EA',
      scope: {
        index: '@',
        animate: '='
      },
      replace: true,
      transclude: true,
      templateUrl: function(tElement, tAttrs) {
        return tAttrs.templateUrl || 'template/modal/window.html';
      },
      link: function (scope, element, attrs) {
        element.addClass(attrs.windowClass || '');
        scope.size = attrs.size;

        $timeout(function () {
          // trigger CSS transitions
          scope.animate = true;
          // focus a freshly-opened modal
          element[0].focus();
        });

        scope.close = function (evt) {
          var modal = $modalStack.getTop();
          if (modal && modal.value.backdrop && modal.value.backdrop != 'static' && (evt.target === evt.currentTarget)) {
            evt.preventDefault();
            evt.stopPropagation();
            $modalStack.dismiss(modal.key, 'backdrop click');
          }
        };
      }
    };
  }])

  .factory('$modalStack', ['$transition', '$timeout', '$document', '$compile', '$rootScope', '$$stackedMap',
    function ($transition, $timeout, $document, $compile, $rootScope, $$stackedMap) {

      var OPENED_MODAL_CLASS = 'modal-open';

      var backdropDomEl, backdropScope;
      var openedWindows = $$stackedMap.createNew();
      var $modalStack = {};

      function backdropIndex() {
        var topBackdropIndex = -1;
        var opened = openedWindows.keys();
        for (var i = 0; i < opened.length; i++) {
          if (openedWindows.get(opened[i]).value.backdrop) {
            topBackdropIndex = i;
          }
        }
        return topBackdropIndex;
      }

      $rootScope.$watch(backdropIndex, function(newBackdropIndex){
        if (backdropScope) {
          backdropScope.index = newBackdropIndex;
        }
      });

      function removeModalWindow(modalInstance) {

        var body = $document.find('body').eq(0);
        var modalWindow = openedWindows.get(modalInstance).value;

        //clean up the stack
        openedWindows.remove(modalInstance);

        //remove window DOM element
        removeAfterAnimate(modalWindow.modalDomEl, modalWindow.modalScope, 300, function() {
          modalWindow.modalScope.$destroy();
          body.toggleClass(OPENED_MODAL_CLASS, openedWindows.length() > 0);
          checkRemoveBackdrop();
        });
      }

      function checkRemoveBackdrop() {
          //remove backdrop if no longer needed
          if (backdropDomEl && backdropIndex() == -1) {
            var backdropScopeRef = backdropScope;
            removeAfterAnimate(backdropDomEl, backdropScope, 150, function () {
              backdropScopeRef.$destroy();
              backdropScopeRef = null;
            });
            backdropDomEl = undefined;
            backdropScope = undefined;
          }
      }

      function removeAfterAnimate(domEl, scope, emulateTime, done) {
        // Closing animation
        scope.animate = false;

        var transitionEndEventName = $transition.transitionEndEventName;
        if (transitionEndEventName) {
          // transition out
          var timeout = $timeout(afterAnimating, emulateTime);

          domEl.bind(transitionEndEventName, function () {
            $timeout.cancel(timeout);
            afterAnimating();
            scope.$apply();
          });
        } else {
          // Ensure this call is async
          $timeout(afterAnimating, 0);
        }

        function afterAnimating() {
          if (afterAnimating.done) {
            return;
          }
          afterAnimating.done = true;

          domEl.remove();
          if (done) {
            done();
          }
        }
      }

      $document.bind('keydown', function (evt) {
        var modal;

        if (evt.which === 27) {
          modal = openedWindows.top();
          if (modal && modal.value.keyboard) {
            evt.preventDefault();
            $rootScope.$apply(function () {
              $modalStack.dismiss(modal.key, 'escape key press');
            });
          }
        }
      });

      $modalStack.open = function (modalInstance, modal) {

        openedWindows.add(modalInstance, {
          deferred: modal.deferred,
          modalScope: modal.scope,
          backdrop: modal.backdrop,
          keyboard: modal.keyboard
        });

        var body = $document.find('body').eq(0),
            currBackdropIndex = backdropIndex();

        if (currBackdropIndex >= 0 && !backdropDomEl) {
          backdropScope = $rootScope.$new(true);
          backdropScope.index = currBackdropIndex;
          backdropDomEl = $compile('<div modal-backdrop></div>')(backdropScope);
          body.append(backdropDomEl);
        }

        var angularDomEl = angular.element('<div modal-window></div>');
        angularDomEl.attr({
          'template-url': modal.windowTemplateUrl,
          'window-class': modal.windowClass,
          'size': modal.size,
          'index': openedWindows.length() - 1,
          'animate': 'animate'
        }).html(modal.content);

        var modalDomEl = $compile(angularDomEl)(modal.scope);
        openedWindows.top().value.modalDomEl = modalDomEl;
        body.append(modalDomEl);
        body.addClass(OPENED_MODAL_CLASS);
      };

      $modalStack.close = function (modalInstance, result) {
        var modalWindow = openedWindows.get(modalInstance).value;
        if (modalWindow) {
          modalWindow.deferred.resolve(result);
          removeModalWindow(modalInstance);
        }
      };

      $modalStack.dismiss = function (modalInstance, reason) {
        var modalWindow = openedWindows.get(modalInstance).value;
        if (modalWindow) {
          modalWindow.deferred.reject(reason);
          removeModalWindow(modalInstance);
        }
      };

      $modalStack.dismissAll = function (reason) {
        var topModal = this.getTop();
        while (topModal) {
          this.dismiss(topModal.key, reason);
          topModal = this.getTop();
        }
      };

      $modalStack.getTop = function () {
        return openedWindows.top();
      };

      return $modalStack;
    }])

  .provider('$modal', function () {

    var $modalProvider = {
      options: {
        backdrop: true, //can be also false or 'static'
        keyboard: true
      },
      $get: ['$injector', '$rootScope', '$q', '$http', '$templateCache', '$controller', '$modalStack',
        function ($injector, $rootScope, $q, $http, $templateCache, $controller, $modalStack) {

          var $modal = {};

          function getTemplatePromise(options) {
            return options.template ? $q.when(options.template) :
              $http.get(options.templateUrl, {cache: $templateCache}).then(function (result) {
                return result.data;
              });
          }

          function getResolvePromises(resolves) {
            var promisesArr = [];
            angular.forEach(resolves, function (value, key) {
              if (angular.isFunction(value) || angular.isArray(value)) {
                promisesArr.push($q.when($injector.invoke(value)));
              }
            });
            return promisesArr;
          }

          $modal.open = function (modalOptions) {

            var modalResultDeferred = $q.defer();
            var modalOpenedDeferred = $q.defer();

            //prepare an instance of a modal to be injected into controllers and returned to a caller
            var modalInstance = {
              result: modalResultDeferred.promise,
              opened: modalOpenedDeferred.promise,
              close: function (result) {
                $modalStack.close(modalInstance, result);
              },
              dismiss: function (reason) {
                $modalStack.dismiss(modalInstance, reason);
              }
            };

            //merge and clean up options
            modalOptions = angular.extend({}, $modalProvider.options, modalOptions);
            modalOptions.resolve = modalOptions.resolve || {};

            //verify options
            if (!modalOptions.template && !modalOptions.templateUrl) {
              throw new Error('One of template or templateUrl options is required.');
            }

            var templateAndResolvePromise =
              $q.all([getTemplatePromise(modalOptions)].concat(getResolvePromises(modalOptions.resolve)));


            templateAndResolvePromise.then(function resolveSuccess(tplAndVars) {

              var modalScope = (modalOptions.scope || $rootScope).$new();
              modalScope.$close = modalInstance.close;
              modalScope.$dismiss = modalInstance.dismiss;

              var ctrlInstance, ctrlLocals = {};
              var resolveIter = 1;

              //controllers
              if (modalOptions.controller) {
                ctrlLocals.$scope = modalScope;
                ctrlLocals.$modalInstance = modalInstance;
                angular.forEach(modalOptions.resolve, function (value, key) {
                  ctrlLocals[key] = tplAndVars[resolveIter++];
                });

                ctrlInstance = $controller(modalOptions.controller, ctrlLocals);
              }

              $modalStack.open(modalInstance, {
                scope: modalScope,
                deferred: modalResultDeferred,
                content: tplAndVars[0],
                backdrop: modalOptions.backdrop,
                keyboard: modalOptions.keyboard,
                windowClass: modalOptions.windowClass,
                windowTemplateUrl: modalOptions.windowTemplateUrl,
                size: modalOptions.size
              });

            }, function resolveError(reason) {
              modalResultDeferred.reject(reason);
            });

            templateAndResolvePromise.then(function () {
              modalOpenedDeferred.resolve(true);
            }, function () {
              modalOpenedDeferred.reject(false);
            });

            return modalInstance;
          };

          return $modal;
        }]
    };

    return $modalProvider;
  });

angular.module('ui.bootstrap.pagination', [])

.controller('PaginationController', ['$scope', '$attrs', '$parse', function ($scope, $attrs, $parse) {
  var self = this,
      ngModelCtrl = { $setViewValue: angular.noop }, // nullModelCtrl
      setNumPages = $attrs.numPages ? $parse($attrs.numPages).assign : angular.noop;

  this.init = function(ngModelCtrl_, config) {
    ngModelCtrl = ngModelCtrl_;
    this.config = config;

    ngModelCtrl.$render = function() {
      self.render();
    };

    if ($attrs.itemsPerPage) {
      $scope.$parent.$watch($parse($attrs.itemsPerPage), function(value) {
        self.itemsPerPage = parseInt(value, 10);
        $scope.totalPages = self.calculateTotalPages();
      });
    } else {
      this.itemsPerPage = config.itemsPerPage;
    }
  };

  this.calculateTotalPages = function() {
    var totalPages = this.itemsPerPage < 1 ? 1 : Math.ceil($scope.totalItems / this.itemsPerPage);
    return Math.max(totalPages || 0, 1);
  };

  this.render = function() {
    $scope.page = parseInt(ngModelCtrl.$viewValue, 10) || 1;
  };

  $scope.selectPage = function(page) {
    if ( $scope.page !== page && page > 0 && page <= $scope.totalPages) {
      ngModelCtrl.$setViewValue(page);
      ngModelCtrl.$render();
    }
  };

  $scope.getText = function( key ) {
    return $scope[key + 'Text'] || self.config[key + 'Text'];
  };
  $scope.noPrevious = function() {
    return $scope.page === 1;
  };
  $scope.noNext = function() {
    return $scope.page === $scope.totalPages;
  };

  $scope.$watch('totalItems', function() {
    $scope.totalPages = self.calculateTotalPages();
  });

  $scope.$watch('totalPages', function(value) {
    setNumPages($scope.$parent, value); // Readonly variable

    if ( $scope.page > value ) {
      $scope.selectPage(value);
    } else {
      ngModelCtrl.$render();
    }
  });
}])

.constant('paginationConfig', {
  itemsPerPage: 10,
  boundaryLinks: false,
  directionLinks: true,
  firstText: 'First',
  previousText: 'Previous',
  nextText: 'Next',
  lastText: 'Last',
  rotate: true
})

.directive('pagination', ['$parse', 'paginationConfig', function($parse, paginationConfig) {
  return {
    restrict: 'EA',
    scope: {
      totalItems: '=',
      firstText: '@',
      previousText: '@',
      nextText: '@',
      lastText: '@'
    },
    require: ['pagination', '?ngModel'],
    controller: 'PaginationController',
    templateUrl: 'template/pagination/pagination.html',
    replace: true,
    link: function(scope, element, attrs, ctrls) {
      var paginationCtrl = ctrls[0], ngModelCtrl = ctrls[1];

      if (!ngModelCtrl) {
         return; // do nothing if no ng-model
      }

      // Setup configuration parameters
      var maxSize = angular.isDefined(attrs.maxSize) ? scope.$parent.$eval(attrs.maxSize) : paginationConfig.maxSize,
          rotate = angular.isDefined(attrs.rotate) ? scope.$parent.$eval(attrs.rotate) : paginationConfig.rotate;
      scope.boundaryLinks = angular.isDefined(attrs.boundaryLinks) ? scope.$parent.$eval(attrs.boundaryLinks) : paginationConfig.boundaryLinks;
      scope.directionLinks = angular.isDefined(attrs.directionLinks) ? scope.$parent.$eval(attrs.directionLinks) : paginationConfig.directionLinks;

      paginationCtrl.init(ngModelCtrl, paginationConfig);

      if (attrs.maxSize) {
        scope.$parent.$watch($parse(attrs.maxSize), function(value) {
          maxSize = parseInt(value, 10);
          paginationCtrl.render();
        });
      }

      // Create page object used in template
      function makePage(number, text, isActive) {
        return {
          number: number,
          text: text,
          active: isActive
        };
      }

      function getPages(currentPage, totalPages) {
        var pages = [];

        // Default page limits
        var startPage = 1, endPage = totalPages;
        var isMaxSized = ( angular.isDefined(maxSize) && maxSize < totalPages );

        // recompute if maxSize
        if ( isMaxSized ) {
          if ( rotate ) {
            // Current page is displayed in the middle of the visible ones
            startPage = Math.max(currentPage - Math.floor(maxSize/2), 1);
            endPage   = startPage + maxSize - 1;

            // Adjust if limit is exceeded
            if (endPage > totalPages) {
              endPage   = totalPages;
              startPage = endPage - maxSize + 1;
            }
          } else {
            // Visible pages are paginated with maxSize
            startPage = ((Math.ceil(currentPage / maxSize) - 1) * maxSize) + 1;

            // Adjust last page if limit is exceeded
            endPage = Math.min(startPage + maxSize - 1, totalPages);
          }
        }

        // Add page number links
        for (var number = startPage; number <= endPage; number++) {
          var page = makePage(number, number, number === currentPage);
          pages.push(page);
        }

        // Add links to move between page sets
        if ( isMaxSized && ! rotate ) {
          if ( startPage > 1 ) {
            var previousPageSet = makePage(startPage - 1, '...', false);
            pages.unshift(previousPageSet);
          }

          if ( endPage < totalPages ) {
            var nextPageSet = makePage(endPage + 1, '...', false);
            pages.push(nextPageSet);
          }
        }

        return pages;
      }

      var originalRender = paginationCtrl.render;
      paginationCtrl.render = function() {
        originalRender();
        if (scope.page > 0 && scope.page <= scope.totalPages) {
          scope.pages = getPages(scope.page, scope.totalPages);
        }
      };
    }
  };
}])

.constant('pagerConfig', {
  itemsPerPage: 10,
  previousText: '« Previous',
  nextText: 'Next »',
  align: true
})

.directive('pager', ['pagerConfig', function(pagerConfig) {
  return {
    restrict: 'EA',
    scope: {
      totalItems: '=',
      previousText: '@',
      nextText: '@'
    },
    require: ['pager', '?ngModel'],
    controller: 'PaginationController',
    templateUrl: 'template/pagination/pager.html',
    replace: true,
    link: function(scope, element, attrs, ctrls) {
      var paginationCtrl = ctrls[0], ngModelCtrl = ctrls[1];

      if (!ngModelCtrl) {
         return; // do nothing if no ng-model
      }

      scope.align = angular.isDefined(attrs.align) ? scope.$parent.$eval(attrs.align) : pagerConfig.align;
      paginationCtrl.init(ngModelCtrl, pagerConfig);
    }
  };
}]);

/**
 * The following features are still outstanding: animation as a
 * function, placement as a function, inside, support for more triggers than
 * just mouse enter/leave, html tooltips, and selector delegation.
 */
angular.module( 'ui.bootstrap.tooltip', [ 'ui.bootstrap.position', 'ui.bootstrap.bindHtml' ] )

/**
 * The $tooltip service creates tooltip- and popover-like directives as well as
 * houses global options for them.
 */
.provider( '$tooltip', function () {
  // The default options tooltip and popover.
  var defaultOptions = {
    placement: 'top',
    animation: true,
    popupDelay: 0
  };

  // Default hide triggers for each show trigger
  var triggerMap = {
    'mouseenter': 'mouseleave',
    'click': 'click',
    'focus': 'blur'
  };

  // The options specified to the provider globally.
  var globalOptions = {};

  /**
   * `options({})` allows global configuration of all tooltips in the
   * application.
   *
   *   var app = angular.module( 'App', ['ui.bootstrap.tooltip'], function( $tooltipProvider ) {
   *     // place tooltips left instead of top by default
   *     $tooltipProvider.options( { placement: 'left' } );
   *   });
   */
	this.options = function( value ) {
		angular.extend( globalOptions, value );
	};

  /**
   * This allows you to extend the set of trigger mappings available. E.g.:
   *
   *   $tooltipProvider.setTriggers( 'openTrigger': 'closeTrigger' );
   */
  this.setTriggers = function setTriggers ( triggers ) {
    angular.extend( triggerMap, triggers );
  };

  /**
   * This is a helper function for translating camel-case to snake-case.
   */
  function snake_case(name){
    var regexp = /[A-Z]/g;
    var separator = '-';
    return name.replace(regexp, function(letter, pos) {
      return (pos ? separator : '') + letter.toLowerCase();
    });
  }

  /**
   * Returns the actual instance of the $tooltip service.
   * TODO support multiple triggers
   */
  this.$get = [ '$window', '$compile', '$timeout', '$parse', '$document', '$position', '$interpolate', function ( $window, $compile, $timeout, $parse, $document, $position, $interpolate ) {
    return function $tooltip ( type, prefix, defaultTriggerShow ) {
      var options = angular.extend( {}, defaultOptions, globalOptions );

      /**
       * Returns an object of show and hide triggers.
       *
       * If a trigger is supplied,
       * it is used to show the tooltip; otherwise, it will use the `trigger`
       * option passed to the `$tooltipProvider.options` method; else it will
       * default to the trigger supplied to this directive factory.
       *
       * The hide trigger is based on the show trigger. If the `trigger` option
       * was passed to the `$tooltipProvider.options` method, it will use the
       * mapped trigger from `triggerMap` or the passed trigger if the map is
       * undefined; otherwise, it uses the `triggerMap` value of the show
       * trigger; else it will just use the show trigger.
       */
      function getTriggers ( trigger ) {
        var show = trigger || options.trigger || defaultTriggerShow;
        var hide = triggerMap[show] || show;
        return {
          show: show,
          hide: hide
        };
      }

      var directiveName = snake_case( type );

      var startSym = $interpolate.startSymbol();
      var endSym = $interpolate.endSymbol();
      var template =
        '<div '+ directiveName +'-popup '+
          'title="'+startSym+'tt_title'+endSym+'" '+
          'content="'+startSym+'tt_content'+endSym+'" '+
          'placement="'+startSym+'tt_placement'+endSym+'" '+
          'animation="tt_animation" '+
          'is-open="tt_isOpen"'+
          '>'+
        '</div>';

      return {
        restrict: 'EA',
        scope: true,
        compile: function (tElem, tAttrs) {
          var tooltipLinker = $compile( template );

          return function link ( scope, element, attrs ) {
            var tooltip;
            var transitionTimeout;
            var popupTimeout;
            var appendToBody = angular.isDefined( options.appendToBody ) ? options.appendToBody : false;
            var triggers = getTriggers( undefined );
            var hasEnableExp = angular.isDefined(attrs[prefix+'Enable']);

            var positionTooltip = function () {

              var ttPosition = $position.positionElements(element, tooltip, scope.tt_placement, appendToBody);
              ttPosition.top += 'px';
              ttPosition.left += 'px';

              // Now set the calculated positioning.
              tooltip.css( ttPosition );
            };

            // By default, the tooltip is not open.
            // TODO add ability to start tooltip opened
            scope.tt_isOpen = false;

            function toggleTooltipBind () {
              if ( ! scope.tt_isOpen ) {
                showTooltipBind();
              } else {
                hideTooltipBind();
              }
            }

            // Show the tooltip with delay if specified, otherwise show it immediately
            function showTooltipBind() {
              if(hasEnableExp && !scope.$eval(attrs[prefix+'Enable'])) {
                return;
              }
              if ( scope.tt_popupDelay ) {
                // Do nothing if the tooltip was already scheduled to pop-up.
                // This happens if show is triggered multiple times before any hide is triggered.
                if (!popupTimeout) {
                  popupTimeout = $timeout( show, scope.tt_popupDelay, false );
                  popupTimeout.then(function(reposition){reposition();});
                }
              } else {
                show()();
              }
            }

            function hideTooltipBind () {
              scope.$apply(function () {
                hide();
              });
            }

            // Show the tooltip popup element.
            function show() {

              popupTimeout = null;

              // If there is a pending remove transition, we must cancel it, lest the
              // tooltip be mysteriously removed.
              if ( transitionTimeout ) {
                $timeout.cancel( transitionTimeout );
                transitionTimeout = null;
              }

              // Don't show empty tooltips.
              if ( ! scope.tt_content ) {
                return angular.noop;
              }

              createTooltip();

              // Set the initial positioning.
              tooltip.css({ top: 0, left: 0, display: 'block' });

              // Now we add it to the DOM because need some info about it. But it's not 
              // visible yet anyway.
              if ( appendToBody ) {
                  $document.find( 'body' ).append( tooltip );
              } else {
                element.after( tooltip );
              }

              positionTooltip();

              // And show the tooltip.
              scope.tt_isOpen = true;
              scope.$digest(); // digest required as $apply is not called

              // Return positioning function as promise callback for correct
              // positioning after draw.
              return positionTooltip;
            }

            // Hide the tooltip popup element.
            function hide() {
              // First things first: we don't show it anymore.
              scope.tt_isOpen = false;

              //if tooltip is going to be shown after delay, we must cancel this
              $timeout.cancel( popupTimeout );
              popupTimeout = null;

              // And now we remove it from the DOM. However, if we have animation, we 
              // need to wait for it to expire beforehand.
              // FIXME: this is a placeholder for a port of the transitions library.
              if ( scope.tt_animation ) {
                if (!transitionTimeout) {
                  transitionTimeout = $timeout(removeTooltip, 500);
                }
              } else {
                removeTooltip();
              }
            }

            function createTooltip() {
              // There can only be one tooltip element per directive shown at once.
              if (tooltip) {
                removeTooltip();
              }
              tooltip = tooltipLinker(scope, function () {});

              // Get contents rendered into the tooltip
              scope.$digest();
            }

            function removeTooltip() {
              transitionTimeout = null;
              if (tooltip) {
                tooltip.remove();
                tooltip = null;
              }
            }

            /**
             * Observe the relevant attributes.
             */
            attrs.$observe( type, function ( val ) {
              scope.tt_content = val;

              if (!val && scope.tt_isOpen ) {
                hide();
              }
            });

            attrs.$observe( prefix+'Title', function ( val ) {
              scope.tt_title = val;
            });

            attrs.$observe( prefix+'Placement', function ( val ) {
              scope.tt_placement = angular.isDefined( val ) ? val : options.placement;
            });

            attrs.$observe( prefix+'PopupDelay', function ( val ) {
              var delay = parseInt( val, 10 );
              scope.tt_popupDelay = ! isNaN(delay) ? delay : options.popupDelay;
            });

            var unregisterTriggers = function () {
              element.unbind(triggers.show, showTooltipBind);
              element.unbind(triggers.hide, hideTooltipBind);
            };

            attrs.$observe( prefix+'Trigger', function ( val ) {
              unregisterTriggers();

              triggers = getTriggers( val );

              if ( triggers.show === triggers.hide ) {
                element.bind( triggers.show, toggleTooltipBind );
              } else {
                element.bind( triggers.show, showTooltipBind );
                element.bind( triggers.hide, hideTooltipBind );
              }
            });

            var animation = scope.$eval(attrs[prefix + 'Animation']);
            scope.tt_animation = angular.isDefined(animation) ? !!animation : options.animation;

            attrs.$observe( prefix+'AppendToBody', function ( val ) {
              appendToBody = angular.isDefined( val ) ? $parse( val )( scope ) : appendToBody;
            });

            // if a tooltip is attached to <body> we need to remove it on
            // location change as its parent scope will probably not be destroyed
            // by the change.
            if ( appendToBody ) {
              scope.$on('$locationChangeSuccess', function closeTooltipOnLocationChangeSuccess () {
              if ( scope.tt_isOpen ) {
                hide();
              }
            });
            }

            // Make sure tooltip is destroyed and removed.
            scope.$on('$destroy', function onDestroyTooltip() {
              $timeout.cancel( transitionTimeout );
              $timeout.cancel( popupTimeout );
              unregisterTriggers();
              removeTooltip();
            });
          };
        }
      };
    };
  }];
})

.directive( 'tooltipPopup', function () {
  return {
    restrict: 'EA',
    replace: true,
    scope: { content: '@', placement: '@', animation: '&', isOpen: '&' },
    templateUrl: 'template/tooltip/tooltip-popup.html'
  };
})

.directive( 'tooltip', [ '$tooltip', function ( $tooltip ) {
  return $tooltip( 'tooltip', 'tooltip', 'mouseenter' );
}])

.directive( 'tooltipHtmlUnsafePopup', function () {
  return {
    restrict: 'EA',
    replace: true,
    scope: { content: '@', placement: '@', animation: '&', isOpen: '&' },
    templateUrl: 'template/tooltip/tooltip-html-unsafe-popup.html'
  };
})

.directive( 'tooltipHtmlUnsafe', [ '$tooltip', function ( $tooltip ) {
  return $tooltip( 'tooltipHtmlUnsafe', 'tooltip', 'mouseenter' );
}]);

/**
 * The following features are still outstanding: popup delay, animation as a
 * function, placement as a function, inside, support for more triggers than
 * just mouse enter/leave, html popovers, and selector delegatation.
 */
angular.module( 'ui.bootstrap.popover', [ 'ui.bootstrap.tooltip' ] )

.directive( 'popoverPopup', function () {
  return {
    restrict: 'EA',
    replace: true,
    scope: { title: '@', content: '@', placement: '@', animation: '&', isOpen: '&' },
    templateUrl: 'template/popover/popover.html'
  };
})

.directive( 'popover', [ '$tooltip', function ( $tooltip ) {
  return $tooltip( 'popover', 'popover', 'click' );
}]);

angular.module('ui.bootstrap.progressbar', [])

.constant('progressConfig', {
  animate: true,
  max: 100
})

.controller('ProgressController', ['$scope', '$attrs', 'progressConfig', function($scope, $attrs, progressConfig) {
    var self = this,
        animate = angular.isDefined($attrs.animate) ? $scope.$parent.$eval($attrs.animate) : progressConfig.animate;

    this.bars = [];
    $scope.max = angular.isDefined($attrs.max) ? $scope.$parent.$eval($attrs.max) : progressConfig.max;

    this.addBar = function(bar, element) {
        if ( !animate ) {
            element.css({'transition': 'none'});
        }

        this.bars.push(bar);

        bar.$watch('value', function( value ) {
            bar.percent = +(100 * value / $scope.max).toFixed(2);
        });

        bar.$on('$destroy', function() {
            element = null;
            self.removeBar(bar);
        });
    };

    this.removeBar = function(bar) {
        this.bars.splice(this.bars.indexOf(bar), 1);
    };
}])

.directive('progress', function() {
    return {
        restrict: 'EA',
        replace: true,
        transclude: true,
        controller: 'ProgressController',
        require: 'progress',
        scope: {},
        templateUrl: 'template/progressbar/progress.html'
    };
})

.directive('bar', function() {
    return {
        restrict: 'EA',
        replace: true,
        transclude: true,
        require: '^progress',
        scope: {
            value: '=',
            type: '@'
        },
        templateUrl: 'template/progressbar/bar.html',
        link: function(scope, element, attrs, progressCtrl) {
            progressCtrl.addBar(scope, element);
        }
    };
})

.directive('progressbar', function() {
    return {
        restrict: 'EA',
        replace: true,
        transclude: true,
        controller: 'ProgressController',
        scope: {
            value: '=',
            type: '@'
        },
        templateUrl: 'template/progressbar/progressbar.html',
        link: function(scope, element, attrs, progressCtrl) {
            progressCtrl.addBar(scope, angular.element(element.children()[0]));
        }
    };
});
angular.module('ui.bootstrap.rating', [])

.constant('ratingConfig', {
  max: 5,
  stateOn: null,
  stateOff: null
})

.controller('RatingController', ['$scope', '$attrs', 'ratingConfig', function($scope, $attrs, ratingConfig) {
  var ngModelCtrl  = { $setViewValue: angular.noop };

  this.init = function(ngModelCtrl_) {
    ngModelCtrl = ngModelCtrl_;
    ngModelCtrl.$render = this.render;

    this.stateOn = angular.isDefined($attrs.stateOn) ? $scope.$parent.$eval($attrs.stateOn) : ratingConfig.stateOn;
    this.stateOff = angular.isDefined($attrs.stateOff) ? $scope.$parent.$eval($attrs.stateOff) : ratingConfig.stateOff;

    var ratingStates = angular.isDefined($attrs.ratingStates) ? $scope.$parent.$eval($attrs.ratingStates) :
                        new Array( angular.isDefined($attrs.max) ? $scope.$parent.$eval($attrs.max) : ratingConfig.max );
    $scope.range = this.buildTemplateObjects(ratingStates);
  };

  this.buildTemplateObjects = function(states) {
    for (var i = 0, n = states.length; i < n; i++) {
      states[i] = angular.extend({ index: i }, { stateOn: this.stateOn, stateOff: this.stateOff }, states[i]);
    }
    return states;
  };

  $scope.rate = function(value) {
    if ( !$scope.readonly && value >= 0 && value <= $scope.range.length ) {
      ngModelCtrl.$setViewValue(value);
      ngModelCtrl.$render();
    }
  };

  $scope.enter = function(value) {
    if ( !$scope.readonly ) {
      $scope.value = value;
    }
    $scope.onHover({value: value});
  };

  $scope.reset = function() {
    $scope.value = ngModelCtrl.$viewValue;
    $scope.onLeave();
  };

  $scope.onKeydown = function(evt) {
    if (/(37|38|39|40)/.test(evt.which)) {
      evt.preventDefault();
      evt.stopPropagation();
      $scope.rate( $scope.value + (evt.which === 38 || evt.which === 39 ? 1 : -1) );
    }
  };

  this.render = function() {
    $scope.value = ngModelCtrl.$viewValue;
  };
}])

.directive('rating', function() {
  return {
    restrict: 'EA',
    require: ['rating', 'ngModel'],
    scope: {
      readonly: '=?',
      onHover: '&',
      onLeave: '&'
    },
    controller: 'RatingController',
    templateUrl: 'template/rating/rating.html',
    replace: true,
    link: function(scope, element, attrs, ctrls) {
      var ratingCtrl = ctrls[0], ngModelCtrl = ctrls[1];

      if ( ngModelCtrl ) {
        ratingCtrl.init( ngModelCtrl );
      }
    }
  };
});

/**
 * @ngdoc overview
 * @name ui.bootstrap.tabs
 *
 * @description
 * AngularJS version of the tabs directive.
 */

angular.module('ui.bootstrap.tabs', [])

.controller('TabsetController', ['$scope', function TabsetCtrl($scope) {
  var ctrl = this,
      tabs = ctrl.tabs = $scope.tabs = [];

  ctrl.select = function(selectedTab) {
    angular.forEach(tabs, function(tab) {
      if (tab.active && tab !== selectedTab) {
        tab.active = false;
        tab.onDeselect();
      }
    });
    selectedTab.active = true;
    selectedTab.onSelect();
  };

  ctrl.addTab = function addTab(tab) {
    tabs.push(tab);
    // we can't run the select function on the first tab
    // since that would select it twice
    if (tabs.length === 1) {
      tab.active = true;
    } else if (tab.active) {
      ctrl.select(tab);
    }
  };

  ctrl.removeTab = function removeTab(tab) {
    var index = tabs.indexOf(tab);
    //Select a new tab if the tab to be removed is selected
    if (tab.active && tabs.length > 1) {
      //If this is the last tab, select the previous tab. else, the next tab.
      var newActiveIndex = index == tabs.length - 1 ? index - 1 : index + 1;
      ctrl.select(tabs[newActiveIndex]);
    }
    tabs.splice(index, 1);
  };
}])

/**
 * @ngdoc directive
 * @name ui.bootstrap.tabs.directive:tabset
 * @restrict EA
 *
 * @description
 * Tabset is the outer container for the tabs directive
 *
 * @param {boolean=} vertical Whether or not to use vertical styling for the tabs.
 * @param {boolean=} justified Whether or not to use justified styling for the tabs.
 *
 * @example
<example module="ui.bootstrap">
  <file name="index.html">
    <tabset>
      <tab heading="Tab 1"><b>First</b> Content!</tab>
      <tab heading="Tab 2"><i>Second</i> Content!</tab>
    </tabset>
    <hr />
    <tabset vertical="true">
      <tab heading="Vertical Tab 1"><b>First</b> Vertical Content!</tab>
      <tab heading="Vertical Tab 2"><i>Second</i> Vertical Content!</tab>
    </tabset>
    <tabset justified="true">
      <tab heading="Justified Tab 1"><b>First</b> Justified Content!</tab>
      <tab heading="Justified Tab 2"><i>Second</i> Justified Content!</tab>
    </tabset>
  </file>
</example>
 */
.directive('tabset', function() {
  return {
    restrict: 'EA',
    transclude: true,
    replace: true,
    scope: {
      type: '@'
    },
    controller: 'TabsetController',
    templateUrl: 'template/tabs/tabset.html',
    link: function(scope, element, attrs) {
      scope.vertical = angular.isDefined(attrs.vertical) ? scope.$parent.$eval(attrs.vertical) : false;
      scope.justified = angular.isDefined(attrs.justified) ? scope.$parent.$eval(attrs.justified) : false;
    }
  };
})

/**
 * @ngdoc directive
 * @name ui.bootstrap.tabs.directive:tab
 * @restrict EA
 *
 * @param {string=} heading The visible heading, or title, of the tab. Set HTML headings with {@link ui.bootstrap.tabs.directive:tabHeading tabHeading}.
 * @param {string=} select An expression to evaluate when the tab is selected.
 * @param {boolean=} active A binding, telling whether or not this tab is selected.
 * @param {boolean=} disabled A binding, telling whether or not this tab is disabled.
 *
 * @description
 * Creates a tab with a heading and content. Must be placed within a {@link ui.bootstrap.tabs.directive:tabset tabset}.
 *
 * @example
<example module="ui.bootstrap">
  <file name="index.html">
    <div ng-controller="TabsDemoCtrl">
      <button class="btn btn-small" ng-click="items[0].active = true">
        Select item 1, using active binding
      </button>
      <button class="btn btn-small" ng-click="items[1].disabled = !items[1].disabled">
        Enable/disable item 2, using disabled binding
      </button>
      <br />
      <tabset>
        <tab heading="Tab 1">First Tab</tab>
        <tab select="alertMe()">
          <tab-heading><i class="icon-bell"></i> Alert me!</tab-heading>
          Second Tab, with alert callback and html heading!
        </tab>
        <tab ng-repeat="item in items"
          heading="{{item.title}}"
          disabled="item.disabled"
          active="item.active">
          {{item.content}}
        </tab>
      </tabset>
    </div>
  </file>
  <file name="script.js">
    function TabsDemoCtrl($scope) {
      $scope.items = [
        { title:"Dynamic Title 1", content:"Dynamic Item 0" },
        { title:"Dynamic Title 2", content:"Dynamic Item 1", disabled: true }
      ];

      $scope.alertMe = function() {
        setTimeout(function() {
          alert("You've selected the alert tab!");
        });
      };
    };
  </file>
</example>
 */

/**
 * @ngdoc directive
 * @name ui.bootstrap.tabs.directive:tabHeading
 * @restrict EA
 *
 * @description
 * Creates an HTML heading for a {@link ui.bootstrap.tabs.directive:tab tab}. Must be placed as a child of a tab element.
 *
 * @example
<example module="ui.bootstrap">
  <file name="index.html">
    <tabset>
      <tab>
        <tab-heading><b>HTML</b> in my titles?!</tab-heading>
        And some content, too!
      </tab>
      <tab>
        <tab-heading><i class="icon-heart"></i> Icon heading?!?</tab-heading>
        That's right.
      </tab>
    </tabset>
  </file>
</example>
 */
.directive('tab', ['$parse', function($parse) {
  return {
    require: '^tabset',
    restrict: 'EA',
    replace: true,
    templateUrl: 'template/tabs/tab.html',
    transclude: true,
    scope: {
      active: '=?',
      heading: '@',
      onSelect: '&select', //This callback is called in contentHeadingTransclude
                          //once it inserts the tab's content into the dom
      onDeselect: '&deselect'
    },
    controller: function() {
      //Empty controller so other directives can require being 'under' a tab
    },
    compile: function(elm, attrs, transclude) {
      return function postLink(scope, elm, attrs, tabsetCtrl) {
        scope.$watch('active', function(active) {
          if (active) {
            tabsetCtrl.select(scope);
          }
        });

        scope.disabled = false;
        if ( attrs.disabled ) {
          scope.$parent.$watch($parse(attrs.disabled), function(value) {
            scope.disabled = !! value;
          });
        }

        scope.select = function() {
          if ( !scope.disabled ) {
            scope.active = true;
          }
        };

        tabsetCtrl.addTab(scope);
        scope.$on('$destroy', function() {
          tabsetCtrl.removeTab(scope);
        });

        //We need to transclude later, once the content container is ready.
        //when this link happens, we're inside a tab heading.
        scope.$transcludeFn = transclude;
      };
    }
  };
}])

.directive('tabHeadingTransclude', [function() {
  return {
    restrict: 'A',
    require: '^tab',
    link: function(scope, elm, attrs, tabCtrl) {
      scope.$watch('headingElement', function updateHeadingElement(heading) {
        if (heading) {
          elm.html('');
          elm.append(heading);
        }
      });
    }
  };
}])

.directive('tabContentTransclude', function() {
  return {
    restrict: 'A',
    require: '^tabset',
    link: function(scope, elm, attrs) {
      var tab = scope.$eval(attrs.tabContentTransclude);

      //Now our tab is ready to be transcluded: both the tab heading area
      //and the tab content area are loaded.  Transclude 'em both.
      tab.$transcludeFn(tab.$parent, function(contents) {
        angular.forEach(contents, function(node) {
          if (isTabHeading(node)) {
            //Let tabHeadingTransclude know.
            tab.headingElement = node;
          } else {
            elm.append(node);
          }
        });
      });
    }
  };
  function isTabHeading(node) {
    return node.tagName &&  (
      node.hasAttribute('tab-heading') ||
      node.hasAttribute('data-tab-heading') ||
      node.tagName.toLowerCase() === 'tab-heading' ||
      node.tagName.toLowerCase() === 'data-tab-heading'
    );
  }
})

;

angular.module('ui.bootstrap.timepicker', [])

.constant('timepickerConfig', {
  hourStep: 1,
  minuteStep: 1,
  showMeridian: true,
  meridians: null,
  readonlyInput: false,
  mousewheel: true
})

.controller('TimepickerController', ['$scope', '$attrs', '$parse', '$log', '$locale', 'timepickerConfig', function($scope, $attrs, $parse, $log, $locale, timepickerConfig) {
  var selected = new Date(),
      ngModelCtrl = { $setViewValue: angular.noop }, // nullModelCtrl
      meridians = angular.isDefined($attrs.meridians) ? $scope.$parent.$eval($attrs.meridians) : timepickerConfig.meridians || $locale.DATETIME_FORMATS.AMPMS;

  this.init = function( ngModelCtrl_, inputs ) {
    ngModelCtrl = ngModelCtrl_;
    ngModelCtrl.$render = this.render;

    var hoursInputEl = inputs.eq(0),
        minutesInputEl = inputs.eq(1);

    var mousewheel = angular.isDefined($attrs.mousewheel) ? $scope.$parent.$eval($attrs.mousewheel) : timepickerConfig.mousewheel;
    if ( mousewheel ) {
      this.setupMousewheelEvents( hoursInputEl, minutesInputEl );
    }

    $scope.readonlyInput = angular.isDefined($attrs.readonlyInput) ? $scope.$parent.$eval($attrs.readonlyInput) : timepickerConfig.readonlyInput;
    this.setupInputEvents( hoursInputEl, minutesInputEl );
  };

  var hourStep = timepickerConfig.hourStep;
  if ($attrs.hourStep) {
    $scope.$parent.$watch($parse($attrs.hourStep), function(value) {
      hourStep = parseInt(value, 10);
    });
  }

  var minuteStep = timepickerConfig.minuteStep;
  if ($attrs.minuteStep) {
    $scope.$parent.$watch($parse($attrs.minuteStep), function(value) {
      minuteStep = parseInt(value, 10);
    });
  }

  // 12H / 24H mode
  $scope.showMeridian = timepickerConfig.showMeridian;
  if ($attrs.showMeridian) {
    $scope.$parent.$watch($parse($attrs.showMeridian), function(value) {
      $scope.showMeridian = !!value;

      if ( ngModelCtrl.$error.time ) {
        // Evaluate from template
        var hours = getHoursFromTemplate(), minutes = getMinutesFromTemplate();
        if (angular.isDefined( hours ) && angular.isDefined( minutes )) {
          selected.setHours( hours );
          refresh();
        }
      } else {
        updateTemplate();
      }
    });
  }

  // Get $scope.hours in 24H mode if valid
  function getHoursFromTemplate ( ) {
    var hours = parseInt( $scope.hours, 10 );
    var valid = ( $scope.showMeridian ) ? (hours > 0 && hours < 13) : (hours >= 0 && hours < 24);
    if ( !valid ) {
      return undefined;
    }

    if ( $scope.showMeridian ) {
      if ( hours === 12 ) {
        hours = 0;
      }
      if ( $scope.meridian === meridians[1] ) {
        hours = hours + 12;
      }
    }
    return hours;
  }

  function getMinutesFromTemplate() {
    var minutes = parseInt($scope.minutes, 10);
    return ( minutes >= 0 && minutes < 60 ) ? minutes : undefined;
  }

  function pad( value ) {
    return ( angular.isDefined(value) && value.toString().length < 2 ) ? '0' + value : value;
  }

  // Respond on mousewheel spin
  this.setupMousewheelEvents = function( hoursInputEl, minutesInputEl ) {
    var isScrollingUp = function(e) {
      if (e.originalEvent) {
        e = e.originalEvent;
      }
      //pick correct delta variable depending on event
      var delta = (e.wheelDelta) ? e.wheelDelta : -e.deltaY;
      return (e.detail || delta > 0);
    };

    hoursInputEl.bind('mousewheel wheel', function(e) {
      $scope.$apply( (isScrollingUp(e)) ? $scope.incrementHours() : $scope.decrementHours() );
      e.preventDefault();
    });

    minutesInputEl.bind('mousewheel wheel', function(e) {
      $scope.$apply( (isScrollingUp(e)) ? $scope.incrementMinutes() : $scope.decrementMinutes() );
      e.preventDefault();
    });

  };

  this.setupInputEvents = function( hoursInputEl, minutesInputEl ) {
    if ( $scope.readonlyInput ) {
      $scope.updateHours = angular.noop;
      $scope.updateMinutes = angular.noop;
      return;
    }

    var invalidate = function(invalidHours, invalidMinutes) {
      ngModelCtrl.$setViewValue( null );
      ngModelCtrl.$setValidity('time', false);
      if (angular.isDefined(invalidHours)) {
        $scope.invalidHours = invalidHours;
      }
      if (angular.isDefined(invalidMinutes)) {
        $scope.invalidMinutes = invalidMinutes;
      }
    };

    $scope.updateHours = function() {
      var hours = getHoursFromTemplate();

      if ( angular.isDefined(hours) ) {
        selected.setHours( hours );
        refresh( 'h' );
      } else {
        invalidate(true);
      }
    };

    hoursInputEl.bind('blur', function(e) {
      if ( !$scope.invalidHours && $scope.hours < 10) {
        $scope.$apply( function() {
          $scope.hours = pad( $scope.hours );
        });
      }
    });

    $scope.updateMinutes = function() {
      var minutes = getMinutesFromTemplate();

      if ( angular.isDefined(minutes) ) {
        selected.setMinutes( minutes );
        refresh( 'm' );
      } else {
        invalidate(undefined, true);
      }
    };

    minutesInputEl.bind('blur', function(e) {
      if ( !$scope.invalidMinutes && $scope.minutes < 10 ) {
        $scope.$apply( function() {
          $scope.minutes = pad( $scope.minutes );
        });
      }
    });

  };

  this.render = function() {
    var date = ngModelCtrl.$modelValue ? new Date( ngModelCtrl.$modelValue ) : null;

    if ( isNaN(date) ) {
      ngModelCtrl.$setValidity('time', false);
      $log.error('Timepicker directive: "ng-model" value must be a Date object, a number of milliseconds since 01.01.1970 or a string representing an RFC2822 or ISO 8601 date.');
    } else {
      if ( date ) {
        selected = date;
      }
      makeValid();
      updateTemplate();
    }
  };

  // Call internally when we know that model is valid.
  function refresh( keyboardChange ) {
    makeValid();
    ngModelCtrl.$setViewValue( new Date(selected) );
    updateTemplate( keyboardChange );
  }

  function makeValid() {
    ngModelCtrl.$setValidity('time', true);
    $scope.invalidHours = false;
    $scope.invalidMinutes = false;
  }

  function updateTemplate( keyboardChange ) {
    var hours = selected.getHours(), minutes = selected.getMinutes();

    if ( $scope.showMeridian ) {
      hours = ( hours === 0 || hours === 12 ) ? 12 : hours % 12; // Convert 24 to 12 hour system
    }

    $scope.hours = keyboardChange === 'h' ? hours : pad(hours);
    $scope.minutes = keyboardChange === 'm' ? minutes : pad(minutes);
    $scope.meridian = selected.getHours() < 12 ? meridians[0] : meridians[1];
  }

  function addMinutes( minutes ) {
    var dt = new Date( selected.getTime() + minutes * 60000 );
    selected.setHours( dt.getHours(), dt.getMinutes() );
    refresh();
  }

  $scope.incrementHours = function() {
    addMinutes( hourStep * 60 );
  };
  $scope.decrementHours = function() {
    addMinutes( - hourStep * 60 );
  };
  $scope.incrementMinutes = function() {
    addMinutes( minuteStep );
  };
  $scope.decrementMinutes = function() {
    addMinutes( - minuteStep );
  };
  $scope.toggleMeridian = function() {
    addMinutes( 12 * 60 * (( selected.getHours() < 12 ) ? 1 : -1) );
  };
}])

.directive('timepicker', function () {
  return {
    restrict: 'EA',
    require: ['timepicker', '?^ngModel'],
    controller:'TimepickerController',
    replace: true,
    scope: {},
    templateUrl: 'template/timepicker/timepicker.html',
    link: function(scope, element, attrs, ctrls) {
      var timepickerCtrl = ctrls[0], ngModelCtrl = ctrls[1];

      if ( ngModelCtrl ) {
        timepickerCtrl.init( ngModelCtrl, element.find('input') );
      }
    }
  };
});

angular.module('ui.bootstrap.typeahead', ['ui.bootstrap.position', 'ui.bootstrap.bindHtml'])

/**
 * A helper service that can parse typeahead's syntax (string provided by users)
 * Extracted to a separate service for ease of unit testing
 */
  .factory('typeaheadParser', ['$parse', function ($parse) {

  //                      00000111000000000000022200000000000000003333333333333330000000000044000
  var TYPEAHEAD_REGEXP = /^\s*(.*?)(?:\s+as\s+(.*?))?\s+for\s+(?:([\$\w][\$\w\d]*))\s+in\s+(.*)$/;

  return {
    parse:function (input) {

      var match = input.match(TYPEAHEAD_REGEXP);
      if (!match) {
        throw new Error(
          'Expected typeahead specification in form of "_modelValue_ (as _label_)? for _item_ in _collection_"' +
            ' but got "' + input + '".');
      }

      return {
        itemName:match[3],
        source:$parse(match[4]),
        viewMapper:$parse(match[2] || match[1]),
        modelMapper:$parse(match[1])
      };
    }
  };
}])

  .directive('typeahead', ['$compile', '$parse', '$q', '$timeout', '$document', '$position', 'typeaheadParser',
    function ($compile, $parse, $q, $timeout, $document, $position, typeaheadParser) {

  var HOT_KEYS = [9, 13, 27, 38, 40];

  return {
    require:'ngModel',
    link:function (originalScope, element, attrs, modelCtrl) {

      //SUPPORTED ATTRIBUTES (OPTIONS)

      //minimal no of characters that needs to be entered before typeahead kicks-in
      var minSearch = originalScope.$eval(attrs.typeaheadMinLength) || 1;

      //minimal wait time after last character typed before typehead kicks-in
      var waitTime = originalScope.$eval(attrs.typeaheadWaitMs) || 0;

      //should it restrict model values to the ones selected from the popup only?
      var isEditable = originalScope.$eval(attrs.typeaheadEditable) !== false;

      //binding to a variable that indicates if matches are being retrieved asynchronously
      var isLoadingSetter = $parse(attrs.typeaheadLoading).assign || angular.noop;

      //a callback executed when a match is selected
      var onSelectCallback = $parse(attrs.typeaheadOnSelect);

      var inputFormatter = attrs.typeaheadInputFormatter ? $parse(attrs.typeaheadInputFormatter) : undefined;

      var appendToBody =  attrs.typeaheadAppendToBody ? originalScope.$eval(attrs.typeaheadAppendToBody) : false;

      //INTERNAL VARIABLES

      //model setter executed upon match selection
      var $setModelValue = $parse(attrs.ngModel).assign;

      //expressions used by typeahead
      var parserResult = typeaheadParser.parse(attrs.typeahead);

      var hasFocus;

      //create a child scope for the typeahead directive so we are not polluting original scope
      //with typeahead-specific data (matches, query etc.)
      var scope = originalScope.$new();
      originalScope.$on('$destroy', function(){
        scope.$destroy();
      });

      // WAI-ARIA
      var popupId = 'typeahead-' + scope.$id + '-' + Math.floor(Math.random() * 10000);
      element.attr({
        'aria-autocomplete': 'list',
        'aria-expanded': false,
        'aria-owns': popupId
      });

      //pop-up element used to display matches
      var popUpEl = angular.element('<div typeahead-popup></div>');
      popUpEl.attr({
        id: popupId,
        matches: 'matches',
        active: 'activeIdx',
        select: 'select(activeIdx)',
        query: 'query',
        position: 'position'
      });
      //custom item template
      if (angular.isDefined(attrs.typeaheadTemplateUrl)) {
        popUpEl.attr('template-url', attrs.typeaheadTemplateUrl);
      }

      var resetMatches = function() {
        scope.matches = [];
        scope.activeIdx = -1;
        element.attr('aria-expanded', false);
      };

      var getMatchId = function(index) {
        return popupId + '-option-' + index;
      };

      // Indicate that the specified match is the active (pre-selected) item in the list owned by this typeahead.
      // This attribute is added or removed automatically when the `activeIdx` changes.
      scope.$watch('activeIdx', function(index) {
        if (index < 0) {
          element.removeAttr('aria-activedescendant');
        } else {
          element.attr('aria-activedescendant', getMatchId(index));
        }
      });

      var getMatchesAsync = function(inputValue) {

        var locals = {$viewValue: inputValue};
        isLoadingSetter(originalScope, true);
        $q.when(parserResult.source(originalScope, locals)).then(function(matches) {

          //it might happen that several async queries were in progress if a user were typing fast
          //but we are interested only in responses that correspond to the current view value
          var onCurrentRequest = (inputValue === modelCtrl.$viewValue);
          if (onCurrentRequest && hasFocus) {
            if (matches.length > 0) {

              scope.activeIdx = 0;
              scope.matches.length = 0;

              //transform labels
              for(var i=0; i<matches.length; i++) {
                locals[parserResult.itemName] = matches[i];
                scope.matches.push({
                  id: getMatchId(i),
                  label: parserResult.viewMapper(scope, locals),
                  model: matches[i]
                });
              }

              scope.query = inputValue;
              //position pop-up with matches - we need to re-calculate its position each time we are opening a window
              //with matches as a pop-up might be absolute-positioned and position of an input might have changed on a page
              //due to other elements being rendered
              scope.position = appendToBody ? $position.offset(element) : $position.position(element);
              scope.position.top = scope.position.top + element.prop('offsetHeight');

              element.attr('aria-expanded', true);
            } else {
              resetMatches();
            }
          }
          if (onCurrentRequest) {
            isLoadingSetter(originalScope, false);
          }
        }, function(){
          resetMatches();
          isLoadingSetter(originalScope, false);
        });
      };

      resetMatches();

      //we need to propagate user's query so we can higlight matches
      scope.query = undefined;

      //Declare the timeout promise var outside the function scope so that stacked calls can be cancelled later 
      var timeoutPromise;

      //plug into $parsers pipeline to open a typeahead on view changes initiated from DOM
      //$parsers kick-in on all the changes coming from the view as well as manually triggered by $setViewValue
      modelCtrl.$parsers.unshift(function (inputValue) {

        hasFocus = true;

        if (inputValue && inputValue.length >= minSearch) {
          if (waitTime > 0) {
            if (timeoutPromise) {
              $timeout.cancel(timeoutPromise);//cancel previous timeout
            }
            timeoutPromise = $timeout(function () {
              getMatchesAsync(inputValue);
            }, waitTime);
          } else {
            getMatchesAsync(inputValue);
          }
        } else {
          isLoadingSetter(originalScope, false);
          resetMatches();
        }

        if (isEditable) {
          return inputValue;
        } else {
          if (!inputValue) {
            // Reset in case user had typed something previously.
            modelCtrl.$setValidity('editable', true);
            return inputValue;
          } else {
            modelCtrl.$setValidity('editable', false);
            return undefined;
          }
        }
      });

      modelCtrl.$formatters.push(function (modelValue) {

        var candidateViewValue, emptyViewValue;
        var locals = {};

        if (inputFormatter) {

          locals['$model'] = modelValue;
          return inputFormatter(originalScope, locals);

        } else {

          //it might happen that we don't have enough info to properly render input value
          //we need to check for this situation and simply return model value if we can't apply custom formatting
          locals[parserResult.itemName] = modelValue;
          candidateViewValue = parserResult.viewMapper(originalScope, locals);
          locals[parserResult.itemName] = undefined;
          emptyViewValue = parserResult.viewMapper(originalScope, locals);

          return candidateViewValue!== emptyViewValue ? candidateViewValue : modelValue;
        }
      });

      scope.select = function (activeIdx) {
        //called from within the $digest() cycle
        var locals = {};
        var model, item;

        locals[parserResult.itemName] = item = scope.matches[activeIdx].model;
        model = parserResult.modelMapper(originalScope, locals);
        $setModelValue(originalScope, model);
        modelCtrl.$setValidity('editable', true);

        onSelectCallback(originalScope, {
          $item: item,
          $model: model,
          $label: parserResult.viewMapper(originalScope, locals)
        });

        resetMatches();

        //return focus to the input element if a match was selected via a mouse click event
        // use timeout to avoid $rootScope:inprog error
        $timeout(function() { element[0].focus(); }, 0, false);
      };

      //bind keyboard events: arrows up(38) / down(40), enter(13) and tab(9), esc(27)
      element.bind('keydown', function (evt) {

        //typeahead is open and an "interesting" key was pressed
        if (scope.matches.length === 0 || HOT_KEYS.indexOf(evt.which) === -1) {
          return;
        }

        evt.preventDefault();

        if (evt.which === 40) {
          scope.activeIdx = (scope.activeIdx + 1) % scope.matches.length;
          scope.$digest();

        } else if (evt.which === 38) {
          scope.activeIdx = (scope.activeIdx ? scope.activeIdx : scope.matches.length) - 1;
          scope.$digest();

        } else if (evt.which === 13 || evt.which === 9) {
          scope.$apply(function () {
            scope.select(scope.activeIdx);
          });

        } else if (evt.which === 27) {
          evt.stopPropagation();

          resetMatches();
          scope.$digest();
        }
      });

      element.bind('blur', function (evt) {
        hasFocus = false;
      });

      // Keep reference to click handler to unbind it.
      var dismissClickHandler = function (evt) {
        if (element[0] !== evt.target) {
          resetMatches();
          scope.$digest();
        }
      };

      $document.bind('click', dismissClickHandler);

      originalScope.$on('$destroy', function(){
        $document.unbind('click', dismissClickHandler);
      });

      var $popup = $compile(popUpEl)(scope);
      if ( appendToBody ) {
        $document.find('body').append($popup);
      } else {
        element.after($popup);
      }
    }
  };

}])

  .directive('typeaheadPopup', function () {
    return {
      restrict:'EA',
      scope:{
        matches:'=',
        query:'=',
        active:'=',
        position:'=',
        select:'&'
      },
      replace:true,
      templateUrl:'template/typeahead/typeahead-popup.html',
      link:function (scope, element, attrs) {

        scope.templateUrl = attrs.templateUrl;

        scope.isOpen = function () {
          return scope.matches.length > 0;
        };

        scope.isActive = function (matchIdx) {
          return scope.active == matchIdx;
        };

        scope.selectActive = function (matchIdx) {
          scope.active = matchIdx;
        };

        scope.selectMatch = function (activeIdx) {
          scope.select({activeIdx:activeIdx});
        };
      }
    };
  })

  .directive('typeaheadMatch', ['$http', '$templateCache', '$compile', '$parse', function ($http, $templateCache, $compile, $parse) {
    return {
      restrict:'EA',
      scope:{
        index:'=',
        match:'=',
        query:'='
      },
      link:function (scope, element, attrs) {
        var tplUrl = $parse(attrs.templateUrl)(scope.$parent) || 'template/typeahead/typeahead-match.html';
        $http.get(tplUrl, {cache: $templateCache}).success(function(tplContent){
           element.replaceWith($compile(tplContent.trim())(scope));
        });
      }
    };
  }])

  .filter('typeaheadHighlight', function() {

    function escapeRegexp(queryToEscape) {
      return queryToEscape.replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1');
    }

    return function(matchItem, query) {
      return query ? ('' + matchItem).replace(new RegExp(escapeRegexp(query), 'gi'), '<strong>$&</strong>') : matchItem;
    };
  });

angular.module("template/accordion/accordion-group.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("template/accordion/accordion-group.html",
    "<div class=\"panel panel-default\">\n" +
    "  <div class=\"panel-heading\">\n" +
    "    <h4 class=\"panel-title\">\n" +
    "      <a class=\"accordion-toggle\" ng-click=\"toggleOpen()\" accordion-transclude=\"heading\"><span ng-class=\"{'text-muted': isDisabled}\">{{heading}}</span></a>\n" +
    "    </h4>\n" +
    "  </div>\n" +
    "  <div class=\"panel-collapse\" collapse=\"!isOpen\">\n" +
    "	  <div class=\"panel-body\" ng-transclude></div>\n" +
    "  </div>\n" +
    "</div>");
}]);

angular.module("template/accordion/accordion.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("template/accordion/accordion.html",
    "<div class=\"panel-group\" ng-transclude></div>");
}]);

angular.module("template/alert/alert.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("template/alert/alert.html",
    "<div class=\"alert\" ng-class=\"{'alert-{{type || 'warning'}}': true, 'alert-dismissable': closeable}\" role=\"alert\">\n" +
    "    <button ng-show=\"closeable\" type=\"button\" class=\"close\" ng-click=\"close()\">\n" +
    "        <span aria-hidden=\"true\">&times;</span>\n" +
    "        <span class=\"sr-only\">Close</span>\n" +
    "    </button>\n" +
    "    <div ng-transclude></div>\n" +
    "</div>\n" +
    "");
}]);

angular.module("template/carousel/carousel.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("template/carousel/carousel.html",
    "<div ng-mouseenter=\"pause()\" ng-mouseleave=\"play()\" class=\"carousel\" ng-swipe-right=\"prev()\" ng-swipe-left=\"next()\">\n" +
    "    <ol class=\"carousel-indicators\" ng-show=\"slides.length > 1\">\n" +
    "        <li ng-repeat=\"slide in slides track by $index\" ng-class=\"{active: isActive(slide)}\" ng-click=\"select(slide)\"></li>\n" +
    "    </ol>\n" +
    "    <div class=\"carousel-inner\" ng-transclude></div>\n" +
    "    <a class=\"left carousel-control\" ng-click=\"prev()\" ng-show=\"slides.length > 1\"><span class=\"glyphicon glyphicon-chevron-left\"></span></a>\n" +
    "    <a class=\"right carousel-control\" ng-click=\"next()\" ng-show=\"slides.length > 1\"><span class=\"glyphicon glyphicon-chevron-right\"></span></a>\n" +
    "</div>\n" +
    "");
}]);

angular.module("template/carousel/slide.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("template/carousel/slide.html",
    "<div ng-class=\"{\n" +
    "    'active': leaving || (active && !entering),\n" +
    "    'prev': (next || active) && direction=='prev',\n" +
    "    'next': (next || active) && direction=='next',\n" +
    "    'right': direction=='prev',\n" +
    "    'left': direction=='next'\n" +
    "  }\" class=\"item text-center\" ng-transclude></div>\n" +
    "");
}]);

angular.module("template/datepicker/datepicker.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("template/datepicker/datepicker.html",
    "<div ng-switch=\"datepickerMode\" role=\"application\" ng-keydown=\"keydown($event)\">\n" +
    "  <daypicker ng-switch-when=\"day\" tabindex=\"0\"></daypicker>\n" +
    "  <monthpicker ng-switch-when=\"month\" tabindex=\"0\"></monthpicker>\n" +
    "  <yearpicker ng-switch-when=\"year\" tabindex=\"0\"></yearpicker>\n" +
    "</div>");
}]);

angular.module("template/datepicker/day.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("template/datepicker/day.html",
    "<table role=\"grid\" aria-labelledby=\"{{uniqueId}}-title\" aria-activedescendant=\"{{activeDateId}}\">\n" +
    "  <thead>\n" +
    "    <tr>\n" +
    "      <th><button type=\"button\" class=\"btn btn-default btn-sm pull-left\" ng-click=\"move(-1)\" tabindex=\"-1\"><i class=\"glyphicon glyphicon-chevron-left\"></i></button></th>\n" +
    "      <th colspan=\"{{5 + showWeeks}}\"><button id=\"{{uniqueId}}-title\" role=\"heading\" aria-live=\"assertive\" aria-atomic=\"true\" type=\"button\" class=\"btn btn-default btn-sm\" ng-click=\"toggleMode()\" tabindex=\"-1\" style=\"width:100%;\"><strong>{{title}}</strong></button></th>\n" +
    "      <th><button type=\"button\" class=\"btn btn-default btn-sm pull-right\" ng-click=\"move(1)\" tabindex=\"-1\"><i class=\"glyphicon glyphicon-chevron-right\"></i></button></th>\n" +
    "    </tr>\n" +
    "    <tr>\n" +
    "      <th ng-show=\"showWeeks\" class=\"text-center\"></th>\n" +
    "      <th ng-repeat=\"label in labels track by $index\" class=\"text-center\"><small aria-label=\"{{label.full}}\">{{label.abbr}}</small></th>\n" +
    "    </tr>\n" +
    "  </thead>\n" +
    "  <tbody>\n" +
    "    <tr ng-repeat=\"row in rows track by $index\">\n" +
    "      <td ng-show=\"showWeeks\" class=\"text-center h6\"><em>{{ weekNumbers[$index] }}</em></td>\n" +
    "      <td ng-repeat=\"dt in row track by dt.date\" class=\"text-center\" role=\"gridcell\" id=\"{{dt.uid}}\" aria-disabled=\"{{!!dt.disabled}}\">\n" +
    "        <button type=\"button\" style=\"width:100%;\" class=\"btn btn-default btn-sm\" ng-class=\"{'btn-info': dt.selected, active: isActive(dt)}\" ng-click=\"select(dt.date)\" ng-disabled=\"dt.disabled\" tabindex=\"-1\"><span ng-class=\"{'text-muted': dt.secondary, 'text-info': dt.current}\">{{dt.label}}</span></button>\n" +
    "      </td>\n" +
    "    </tr>\n" +
    "  </tbody>\n" +
    "</table>\n" +
    "");
}]);

angular.module("template/datepicker/month.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("template/datepicker/month.html",
    "<table role=\"grid\" aria-labelledby=\"{{uniqueId}}-title\" aria-activedescendant=\"{{activeDateId}}\">\n" +
    "  <thead>\n" +
    "    <tr>\n" +
    "      <th><button type=\"button\" class=\"btn btn-default btn-sm pull-left\" ng-click=\"move(-1)\" tabindex=\"-1\"><i class=\"glyphicon glyphicon-chevron-left\"></i></button></th>\n" +
    "      <th><button id=\"{{uniqueId}}-title\" role=\"heading\" aria-live=\"assertive\" aria-atomic=\"true\" type=\"button\" class=\"btn btn-default btn-sm\" ng-click=\"toggleMode()\" tabindex=\"-1\" style=\"width:100%;\"><strong>{{title}}</strong></button></th>\n" +
    "      <th><button type=\"button\" class=\"btn btn-default btn-sm pull-right\" ng-click=\"move(1)\" tabindex=\"-1\"><i class=\"glyphicon glyphicon-chevron-right\"></i></button></th>\n" +
    "    </tr>\n" +
    "  </thead>\n" +
    "  <tbody>\n" +
    "    <tr ng-repeat=\"row in rows track by $index\">\n" +
    "      <td ng-repeat=\"dt in row track by dt.date\" class=\"text-center\" role=\"gridcell\" id=\"{{dt.uid}}\" aria-disabled=\"{{!!dt.disabled}}\">\n" +
    "        <button type=\"button\" style=\"width:100%;\" class=\"btn btn-default\" ng-class=\"{'btn-info': dt.selected, active: isActive(dt)}\" ng-click=\"select(dt.date)\" ng-disabled=\"dt.disabled\" tabindex=\"-1\"><span ng-class=\"{'text-info': dt.current}\">{{dt.label}}</span></button>\n" +
    "      </td>\n" +
    "    </tr>\n" +
    "  </tbody>\n" +
    "</table>\n" +
    "");
}]);

angular.module("template/datepicker/popup.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("template/datepicker/popup.html",
    "<ul class=\"dropdown-menu\" ng-style=\"{display: (isOpen && 'block') || 'none', top: position.top+'px', left: position.left+'px'}\" ng-keydown=\"keydown($event)\">\n" +
    "	<li ng-transclude></li>\n" +
    "	<li ng-if=\"showButtonBar\" style=\"padding:10px 9px 2px\">\n" +
    "		<span class=\"btn-group\">\n" +
    "			<button type=\"button\" class=\"btn btn-sm btn-info\" ng-click=\"select('today')\">{{ getText('current') }}</button>\n" +
    "			<button type=\"button\" class=\"btn btn-sm btn-danger\" ng-click=\"select(null)\">{{ getText('clear') }}</button>\n" +
    "		</span>\n" +
    "		<button type=\"button\" class=\"btn btn-sm btn-success pull-right\" ng-click=\"close()\">{{ getText('close') }}</button>\n" +
    "	</li>\n" +
    "</ul>\n" +
    "");
}]);

angular.module("template/datepicker/year.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("template/datepicker/year.html",
    "<table role=\"grid\" aria-labelledby=\"{{uniqueId}}-title\" aria-activedescendant=\"{{activeDateId}}\">\n" +
    "  <thead>\n" +
    "    <tr>\n" +
    "      <th><button type=\"button\" class=\"btn btn-default btn-sm pull-left\" ng-click=\"move(-1)\" tabindex=\"-1\"><i class=\"glyphicon glyphicon-chevron-left\"></i></button></th>\n" +
    "      <th colspan=\"3\"><button id=\"{{uniqueId}}-title\" role=\"heading\" aria-live=\"assertive\" aria-atomic=\"true\" type=\"button\" class=\"btn btn-default btn-sm\" ng-click=\"toggleMode()\" tabindex=\"-1\" style=\"width:100%;\"><strong>{{title}}</strong></button></th>\n" +
    "      <th><button type=\"button\" class=\"btn btn-default btn-sm pull-right\" ng-click=\"move(1)\" tabindex=\"-1\"><i class=\"glyphicon glyphicon-chevron-right\"></i></button></th>\n" +
    "    </tr>\n" +
    "  </thead>\n" +
    "  <tbody>\n" +
    "    <tr ng-repeat=\"row in rows track by $index\">\n" +
    "      <td ng-repeat=\"dt in row track by dt.date\" class=\"text-center\" role=\"gridcell\" id=\"{{dt.uid}}\" aria-disabled=\"{{!!dt.disabled}}\">\n" +
    "        <button type=\"button\" style=\"width:100%;\" class=\"btn btn-default\" ng-class=\"{'btn-info': dt.selected, active: isActive(dt)}\" ng-click=\"select(dt.date)\" ng-disabled=\"dt.disabled\" tabindex=\"-1\"><span ng-class=\"{'text-info': dt.current}\">{{dt.label}}</span></button>\n" +
    "      </td>\n" +
    "    </tr>\n" +
    "  </tbody>\n" +
    "</table>\n" +
    "");
}]);

angular.module("template/modal/backdrop.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("template/modal/backdrop.html",
    "<div class=\"modal-backdrop fade\"\n" +
    "     ng-class=\"{in: animate}\"\n" +
    "     ng-style=\"{'z-index': 1040 + (index && 1 || 0) + index*10}\"\n" +
    "></div>\n" +
    "");
}]);

angular.module("template/modal/window.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("template/modal/window.html",
    "<div tabindex=\"-1\" role=\"dialog\" class=\"modal fade\" ng-class=\"{in: animate}\" ng-style=\"{'z-index': 1050 + index*10, display: 'block'}\" ng-click=\"close($event)\">\n" +
    "    <div class=\"modal-dialog\" ng-class=\"{'modal-sm': size == 'sm', 'modal-lg': size == 'lg'}\"><div class=\"modal-content\" ng-transclude></div></div>\n" +
    "</div>");
}]);

angular.module("template/pagination/pager.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("template/pagination/pager.html",
    "<ul class=\"pager\">\n" +
    "  <li ng-class=\"{disabled: noPrevious(), previous: align}\"><a href ng-click=\"selectPage(page - 1)\">{{getText('previous')}}</a></li>\n" +
    "  <li ng-class=\"{disabled: noNext(), next: align}\"><a href ng-click=\"selectPage(page + 1)\">{{getText('next')}}</a></li>\n" +
    "</ul>");
}]);

angular.module("template/pagination/pagination.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("template/pagination/pagination.html",
    "<ul class=\"pagination\">\n" +
    "  <li ng-if=\"boundaryLinks\" ng-class=\"{disabled: noPrevious()}\"><a href ng-click=\"selectPage(1)\">{{getText('first')}}</a></li>\n" +
    "  <li ng-if=\"directionLinks\" ng-class=\"{disabled: noPrevious()}\"><a href ng-click=\"selectPage(page - 1)\">{{getText('previous')}}</a></li>\n" +
    "  <li ng-repeat=\"page in pages track by $index\" ng-class=\"{active: page.active}\"><a href ng-click=\"selectPage(page.number)\">{{page.text}}</a></li>\n" +
    "  <li ng-if=\"directionLinks\" ng-class=\"{disabled: noNext()}\"><a href ng-click=\"selectPage(page + 1)\">{{getText('next')}}</a></li>\n" +
    "  <li ng-if=\"boundaryLinks\" ng-class=\"{disabled: noNext()}\"><a href ng-click=\"selectPage(totalPages)\">{{getText('last')}}</a></li>\n" +
    "</ul>");
}]);

angular.module("template/tooltip/tooltip-html-unsafe-popup.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("template/tooltip/tooltip-html-unsafe-popup.html",
    "<div class=\"tooltip {{placement}}\" ng-class=\"{ in: isOpen(), fade: animation() }\">\n" +
    "  <div class=\"tooltip-arrow\"></div>\n" +
    "  <div class=\"tooltip-inner\" bind-html-unsafe=\"content\"></div>\n" +
    "</div>\n" +
    "");
}]);

angular.module("template/tooltip/tooltip-popup.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("template/tooltip/tooltip-popup.html",
    "<div class=\"tooltip {{placement}}\" ng-class=\"{ in: isOpen(), fade: animation() }\">\n" +
    "  <div class=\"tooltip-arrow\"></div>\n" +
    "  <div class=\"tooltip-inner\" ng-bind=\"content\"></div>\n" +
    "</div>\n" +
    "");
}]);

angular.module("template/popover/popover.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("template/popover/popover.html",
    "<div class=\"popover {{placement}}\" ng-class=\"{ in: isOpen(), fade: animation() }\">\n" +
    "  <div class=\"arrow\"></div>\n" +
    "\n" +
    "  <div class=\"popover-inner\">\n" +
    "      <h3 class=\"popover-title\" ng-bind=\"title\" ng-show=\"title\"></h3>\n" +
    "      <div class=\"popover-content\" ng-bind=\"content\"></div>\n" +
    "  </div>\n" +
    "</div>\n" +
    "");
}]);

angular.module("template/progressbar/bar.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("template/progressbar/bar.html",
    "<div class=\"progress-bar\" ng-class=\"type && 'progress-bar-' + type\" role=\"progressbar\" aria-valuenow=\"{{value}}\" aria-valuemin=\"0\" aria-valuemax=\"{{max}}\" ng-style=\"{width: percent + '%'}\" aria-valuetext=\"{{percent | number:0}}%\" ng-transclude></div>");
}]);

angular.module("template/progressbar/progress.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("template/progressbar/progress.html",
    "<div class=\"progress\" ng-transclude></div>");
}]);

angular.module("template/progressbar/progressbar.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("template/progressbar/progressbar.html",
    "<div class=\"progress\">\n" +
    "  <div class=\"progress-bar\" ng-class=\"type && 'progress-bar-' + type\" role=\"progressbar\" aria-valuenow=\"{{value}}\" aria-valuemin=\"0\" aria-valuemax=\"{{max}}\" ng-style=\"{width: percent + '%'}\" aria-valuetext=\"{{percent | number:0}}%\" ng-transclude></div>\n" +
    "</div>");
}]);

angular.module("template/rating/rating.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("template/rating/rating.html",
    "<span ng-mouseleave=\"reset()\" ng-keydown=\"onKeydown($event)\" tabindex=\"0\" role=\"slider\" aria-valuemin=\"0\" aria-valuemax=\"{{range.length}}\" aria-valuenow=\"{{value}}\">\n" +
    "    <i ng-repeat=\"r in range track by $index\" ng-mouseenter=\"enter($index + 1)\" ng-click=\"rate($index + 1)\" class=\"glyphicon\" ng-class=\"$index < value && (r.stateOn || 'glyphicon-star') || (r.stateOff || 'glyphicon-star-empty')\">\n" +
    "        <span class=\"sr-only\">({{ $index < value ? '*' : ' ' }})</span>\n" +
    "    </i>\n" +
    "</span>");
}]);

angular.module("template/tabs/tab.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("template/tabs/tab.html",
    "<li ng-class=\"{active: active, disabled: disabled}\">\n" +
    "  <a ng-click=\"select()\" tab-heading-transclude>{{heading}}</a>\n" +
    "</li>\n" +
    "");
}]);

angular.module("template/tabs/tabset-titles.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("template/tabs/tabset-titles.html",
    "<ul class=\"nav {{type && 'nav-' + type}}\" ng-class=\"{'nav-stacked': vertical}\">\n" +
    "</ul>\n" +
    "");
}]);

angular.module("template/tabs/tabset.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("template/tabs/tabset.html",
    "\n" +
    "<div>\n" +
    "  <ul class=\"nav nav-{{type || 'tabs'}}\" ng-class=\"{'nav-stacked': vertical, 'nav-justified': justified}\" ng-transclude></ul>\n" +
    "  <div class=\"tab-content\">\n" +
    "    <div class=\"tab-pane\" \n" +
    "         ng-repeat=\"tab in tabs\" \n" +
    "         ng-class=\"{active: tab.active}\"\n" +
    "         tab-content-transclude=\"tab\">\n" +
    "    </div>\n" +
    "  </div>\n" +
    "</div>\n" +
    "");
}]);

angular.module("template/timepicker/timepicker.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("template/timepicker/timepicker.html",
    "<table>\n" +
    "	<tbody>\n" +
    "		<tr class=\"text-center\">\n" +
    "			<td><a ng-click=\"incrementHours()\" class=\"btn btn-link\"><span class=\"glyphicon glyphicon-chevron-up\"></span></a></td>\n" +
    "			<td>&nbsp;</td>\n" +
    "			<td><a ng-click=\"incrementMinutes()\" class=\"btn btn-link\"><span class=\"glyphicon glyphicon-chevron-up\"></span></a></td>\n" +
    "			<td ng-show=\"showMeridian\"></td>\n" +
    "		</tr>\n" +
    "		<tr>\n" +
    "			<td style=\"width:50px;\" class=\"form-group\" ng-class=\"{'has-error': invalidHours}\">\n" +
    "				<input type=\"text\" ng-model=\"hours\" ng-change=\"updateHours()\" class=\"form-control text-center\" ng-mousewheel=\"incrementHours()\" ng-readonly=\"readonlyInput\" maxlength=\"2\">\n" +
    "			</td>\n" +
    "			<td>:</td>\n" +
    "			<td style=\"width:50px;\" class=\"form-group\" ng-class=\"{'has-error': invalidMinutes}\">\n" +
    "				<input type=\"text\" ng-model=\"minutes\" ng-change=\"updateMinutes()\" class=\"form-control text-center\" ng-readonly=\"readonlyInput\" maxlength=\"2\">\n" +
    "			</td>\n" +
    "			<td ng-show=\"showMeridian\"><button type=\"button\" class=\"btn btn-default text-center\" ng-click=\"toggleMeridian()\">{{meridian}}</button></td>\n" +
    "		</tr>\n" +
    "		<tr class=\"text-center\">\n" +
    "			<td><a ng-click=\"decrementHours()\" class=\"btn btn-link\"><span class=\"glyphicon glyphicon-chevron-down\"></span></a></td>\n" +
    "			<td>&nbsp;</td>\n" +
    "			<td><a ng-click=\"decrementMinutes()\" class=\"btn btn-link\"><span class=\"glyphicon glyphicon-chevron-down\"></span></a></td>\n" +
    "			<td ng-show=\"showMeridian\"></td>\n" +
    "		</tr>\n" +
    "	</tbody>\n" +
    "</table>\n" +
    "");
}]);

angular.module("template/typeahead/typeahead-match.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("template/typeahead/typeahead-match.html",
    "<a tabindex=\"-1\" bind-html-unsafe=\"match.label | typeaheadHighlight:query\"></a>");
}]);

angular.module("template/typeahead/typeahead-popup.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("template/typeahead/typeahead-popup.html",
    "<ul class=\"dropdown-menu\" ng-if=\"isOpen()\" ng-style=\"{top: position.top+'px', left: position.left+'px'}\" style=\"display: block;\" role=\"listbox\" aria-hidden=\"{{!isOpen()}}\">\n" +
    "    <li ng-repeat=\"match in matches track by $index\" ng-class=\"{active: isActive($index) }\" ng-mouseenter=\"selectActive($index)\" ng-click=\"selectMatch($index)\" role=\"option\" id=\"{{match.id}}\">\n" +
    "        <div typeahead-match index=\"$index\" match=\"match\" query=\"query\" template-url=\"templateUrl\"></div>\n" +
    "    </li>\n" +
    "</ul>");
}]);

/*!
 * bootstrap-select v1.5.4
 * http://silviomoreto.github.io/bootstrap-select/
 *
 * Copyright 2013 bootstrap-select
 * Licensed under the MIT license
 */

!function($) {

    'use strict';

    $.expr[':'].icontains = function(obj, index, meta) {
        return $(obj).text().toUpperCase().indexOf(meta[3].toUpperCase()) >= 0;
    };

    var Selectpicker = function(element, options, e) {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        this.$element = $(element);
        this.$newElement = null;
        this.$button = null;
        this.$menu = null;
        this.$lis = null;

        //Merge defaults, options and data-attributes to make our options
        this.options = $.extend({}, $.fn.selectpicker.defaults, this.$element.data(), typeof options == 'object' && options);

        //If we have no title yet, check the attribute 'title' (this is missed by jq as its not a data-attribute
        if (this.options.title === null) {
            this.options.title = this.$element.attr('title');
        }

        //Expose public methods
        this.val = Selectpicker.prototype.val;
        this.render = Selectpicker.prototype.render;
        this.refresh = Selectpicker.prototype.refresh;
        this.setStyle = Selectpicker.prototype.setStyle;
        this.selectAll = Selectpicker.prototype.selectAll;
        this.deselectAll = Selectpicker.prototype.deselectAll;
        this.init();
    };

    Selectpicker.prototype = {

        constructor: Selectpicker,

        init: function() {
            var that = this,
                id = this.$element.attr('id');

            this.$element.hide();
            this.multiple = this.$element.prop('multiple');
            this.autofocus = this.$element.prop('autofocus');
            this.$newElement = this.createView();
            this.$element.after(this.$newElement);
            this.$menu = this.$newElement.find('> .dropdown-menu');
            this.$button = this.$newElement.find('> button');
            this.$searchbox = this.$newElement.find('input');

            if (id !== undefined) {
                this.$button.attr('data-id', id);
                $('label[for="' + id + '"]').click(function(e) {
                    e.preventDefault();
                    that.$button.focus();
                });
            }

            this.checkDisabled();
            this.clickListener();
            if (this.options.liveSearch) this.liveSearchListener();
            this.render();
            this.liHeight();
            this.setStyle();
            this.setWidth();
            if (this.options.container) this.selectPosition();
            this.$menu.data('this', this);
            this.$newElement.data('this', this);
        },

        createDropdown: function() {
            //If we are multiple, then add the show-tick class by default
            var multiple = this.multiple ? ' show-tick' : '';
            var inputGroup = this.$element.parent().hasClass('input-group') ? ' input-group-btn' : '';
            var autofocus = this.autofocus ? ' autofocus' : '';
            var header = this.options.header ? '<div class="popover-title"><button type="button" class="close" aria-hidden="true">&times;</button>' + this.options.header + '</div>' : '';
            var searchbox = this.options.liveSearch ? '<div class="bootstrap-select-searchbox"><input type="text" class="input-block-level form-control" autocomplete="off" /></div>' : '';
            var actionsbox = this.options.actionsBox ? '<div class="bs-actionsbox">' +
                                '<div class="btn-group btn-block">' +
                                    '<button class="actions-btn bs-select-all btn btn-sm btn-default">' +
                                        'Select All' +
                                    '</button>' +
                                    '<button class="actions-btn bs-deselect-all btn btn-sm btn-default">' +
                                        'Deselect All' +
                                    '</button>' +
                                  '</div>' +
                            '</div>' : '';
            var drop =
                '<div class="btn-group bootstrap-select' + multiple + inputGroup + '">' +
                    '<button type="button" class="btn dropdown-toggle selectpicker" data-toggle="dropdown"'+ autofocus +'>' +
                        '<span class="filter-option pull-left"></span>&nbsp;' +
                        '<span class="caret"></span>' +
                    '</button>' +
                    '<div class="dropdown-menu open">' +
                        header +
                        searchbox +
                        actionsbox +
                        '<ul class="dropdown-menu inner selectpicker" role="menu">' +
                        '</ul>' +
                    '</div>' +
                '</div>';

            return $(drop);
        },

        createView: function() {
            var $drop = this.createDropdown();
            var $li = this.createLi();
            $drop.find('ul').append($li);
            return $drop;
        },

        reloadLi: function() {
            //Remove all children.
            this.destroyLi();
            //Re build
            var $li = this.createLi();
            this.$menu.find('ul').append( $li );
        },

        destroyLi: function() {
            this.$menu.find('li').remove();
        },

        createLi: function() {
            var that = this,
                _liA = [],
                _liHtml = '';

            this.$element.find('option').each(function() {
                var $this = $(this);

                //Get the class and text for the option
                var optionClass = $this.attr('class') || '';
                var inline = $this.attr('style') || '';
                var text =  $this.data('content') ? $this.data('content') : $this.html();
                var subtext = $this.data('subtext') !== undefined ? '<small class="muted text-muted">' + $this.data('subtext') + '</small>' : '';
                var icon = $this.data('icon') !== undefined ? '<i class="' + that.options.iconBase + ' ' + $this.data('icon') + '"></i> ' : '';
                if (icon !== '' && ($this.is(':disabled') || $this.parent().is(':disabled'))) {
                    icon = '<span>'+icon+'</span>';
                }

                if (!$this.data('content')) {
                    //Prepend any icon and append any subtext to the main text.
                    text = icon + '<span class="text">' + text + subtext + '</span>';
                }

                if (that.options.hideDisabled && ($this.is(':disabled') || $this.parent().is(':disabled'))) {
                    _liA.push('<a style="min-height: 0; padding: 0"></a>');
                } else if ($this.parent().is('optgroup') && $this.data('divider') !== true) {
                    if ($this.index() === 0) {
                        //Get the opt group label
                        var label = $this.parent().attr('label');
                        var labelSubtext = $this.parent().data('subtext') !== undefined ? '<small class="muted text-muted">'+$this.parent().data('subtext')+'</small>' : '';
                        var labelIcon = $this.parent().data('icon') ? '<i class="'+$this.parent().data('icon')+'"></i> ' : '';
                        label = labelIcon + '<span class="text">' + label + labelSubtext + '</span>';

                        if ($this[0].index !== 0) {
                            _liA.push(
                                '<div class="div-contain"><div class="divider"></div></div>'+
                                '<dt>'+label+'</dt>'+
                                that.createA(text, 'opt ' + optionClass, inline )
                                );
                        } else {
                            _liA.push(
                                '<dt>'+label+'</dt>'+
                                that.createA(text, 'opt ' + optionClass, inline ));
                        }
                    } else {
                         _liA.push(that.createA(text, 'opt ' + optionClass, inline ));
                    }
                } else if ($this.data('divider') === true) {
                    _liA.push('<div class="div-contain"><div class="divider"></div></div>');
                } else if ($(this).data('hidden') === true) {
                    _liA.push('<a></a>');
                } else {
                    _liA.push(that.createA(text, optionClass, inline ));
                }
            });

            $.each(_liA, function(i, item) {
                var hide = item === '<a></a>' ? 'class="hide is-hidden"' : '';
                _liHtml += '<li rel="' + i + '"' + hide + '>' + item + '</li>';
            });

            //If we are not multiple, and we dont have a selected item, and we dont have a title, select the first element so something is set in the button
            if (!this.multiple && this.$element.find('option:selected').length===0 && !this.options.title) {
                this.$element.find('option').eq(0).prop('selected', true).attr('selected', 'selected');
            }

            return $(_liHtml);
        },

        createA: function(text, classes, inline) {
            return '<a tabindex="0" class="'+classes+'" style="'+inline+'">' +
                 text +
                 '<i class="' + this.options.iconBase + ' ' + this.options.tickIcon + ' icon-ok check-mark"></i>' +
                 '</a>';
        },

        render: function(updateLi) {
            var that = this;

            //Update the LI to match the SELECT
            if (updateLi !== false) {
                this.$element.find('option').each(function(index) {
                   that.setDisabled(index, $(this).is(':disabled') || $(this).parent().is(':disabled') );
                   that.setSelected(index, $(this).is(':selected') );
                });
            }

            this.tabIndex();

            var selectedItems = this.$element.find('option:selected').map(function() {
                var $this = $(this);
                var icon = $this.data('icon') && that.options.showIcon ? '<i class="' + that.options.iconBase + ' ' + $this.data('icon') + '"></i> ' : '';
                var subtext;
                if (that.options.showSubtext && $this.attr('data-subtext') && !that.multiple) {
                    subtext = ' <small class="muted text-muted">'+$this.data('subtext') +'</small>';
                } else {
                    subtext = '';
                }
                if ($this.data('content') && that.options.showContent) {
                    return $this.data('content');
                } else if ($this.attr('title') !== undefined) {
                    return $this.attr('title');
                } else {
                    return icon + $this.html() + subtext;
                }
            }).toArray();

            //Fixes issue in IE10 occurring when no default option is selected and at least one option is disabled
            //Convert all the values into a comma delimited string
            var title = !this.multiple ? selectedItems[0] : selectedItems.join(this.options.multipleSeparator);

            //If this is multi select, and the selectText type is count, the show 1 of 2 selected etc..
            if (this.multiple && this.options.selectedTextFormat.indexOf('count') > -1) {
                var max = this.options.selectedTextFormat.split('>');
                var notDisabled = this.options.hideDisabled ? ':not([disabled])' : '';
                if ( (max.length>1 && selectedItems.length > max[1]) || (max.length==1 && selectedItems.length>=2)) {
                    title = this.options.countSelectedText.replace('{0}', selectedItems.length).replace('{1}', this.$element.find('option:not([data-divider="true"]):not([data-hidden="true"])'+notDisabled).length);
                }
             }

            this.options.title = this.$element.attr('title');

            //If we dont have a title, then use the default, or if nothing is set at all, use the not selected text
            if (!title) {
                title = this.options.title !== undefined ? this.options.title : this.options.noneSelectedText;
            }

            this.$button.attr('title', $.trim(title));
            this.$newElement.find('.filter-option').html(title);
        },

        setStyle: function(style, status) {
            if (this.$element.attr('class')) {
                this.$newElement.addClass(this.$element.attr('class').replace(/selectpicker|mobile-device|validate\[.*\]/gi, ''));
            }

            var buttonClass = style ? style : this.options.style;

            if (status == 'add') {
                this.$button.addClass(buttonClass);
            } else if (status == 'remove') {
                this.$button.removeClass(buttonClass);
            } else {
                this.$button.removeClass(this.options.style);
                this.$button.addClass(buttonClass);
            }
        },

        liHeight: function() {
            if (this.options.size === false) return;

            var $selectClone = this.$menu.parent().clone().find('> .dropdown-toggle').prop('autofocus', false).end().appendTo('body'),
                $menuClone = $selectClone.addClass('open').find('> .dropdown-menu'),
                liHeight = $menuClone.find('li > a').outerHeight(),
                headerHeight = this.options.header ? $menuClone.find('.popover-title').outerHeight() : 0,
                searchHeight = this.options.liveSearch ? $menuClone.find('.bootstrap-select-searchbox').outerHeight() : 0,
                actionsHeight = this.options.actionsBox ? $menuClone.find('.bs-actionsbox').outerHeight() : 0;

            $selectClone.remove();

            this.$newElement
                .data('liHeight', liHeight)
                .data('headerHeight', headerHeight)
                .data('searchHeight', searchHeight)
                .data('actionsHeight', actionsHeight);
        },

        setSize: function() {
            var that = this,
                menu = this.$menu,
                menuInner = menu.find('.inner'),
                selectHeight = this.$newElement.outerHeight(),
                liHeight = this.$newElement.data('liHeight'),
                headerHeight = this.$newElement.data('headerHeight'),
                searchHeight = this.$newElement.data('searchHeight'),
                actionsHeight = this.$newElement.data('actionsHeight'),
                divHeight = menu.find('li .divider').outerHeight(true),
                menuPadding = parseInt(menu.css('padding-top')) +
                              parseInt(menu.css('padding-bottom')) +
                              parseInt(menu.css('border-top-width')) +
                              parseInt(menu.css('border-bottom-width')),
                notDisabled = this.options.hideDisabled ? ':not(.disabled)' : '',
                $window = $(window),
                menuExtras = menuPadding + parseInt(menu.css('margin-top')) + parseInt(menu.css('margin-bottom')) + 2,
                menuHeight,
                selectOffsetTop,
                selectOffsetBot,
                posVert = function() {
                    selectOffsetTop = that.$newElement.offset().top - $window.scrollTop();
                    selectOffsetBot = $window.height() - selectOffsetTop - selectHeight;
                };
                posVert();
                if (this.options.header) menu.css('padding-top', 0);

            if (this.options.size == 'auto') {
                var getSize = function() {
                    var minHeight,
                        lisVis = that.$lis.not('.hide');

                    posVert();
                    menuHeight = selectOffsetBot - menuExtras;

                    if (that.options.dropupAuto) {
                        that.$newElement.toggleClass('dropup', (selectOffsetTop > selectOffsetBot) && ((menuHeight - menuExtras) < menu.height()));
                    }
                    if (that.$newElement.hasClass('dropup')) {
                        menuHeight = selectOffsetTop - menuExtras;
                    }

                    if ((lisVis.length + lisVis.find('dt').length) > 3) {
                        minHeight = liHeight*3 + menuExtras - 2;
                    } else {
                        minHeight = 0;
                    }

                    menu.css({'max-height' : menuHeight + 'px', 'overflow' : 'hidden', 'min-height' : minHeight + headerHeight + searchHeight + actionsHeight + 'px'});
                    menuInner.css({'max-height' : menuHeight - headerHeight - searchHeight - actionsHeight - menuPadding + 'px', 'overflow-y' : 'auto', 'min-height' : Math.max(minHeight - menuPadding, 0) + 'px'});
                };
                getSize();
                this.$searchbox.off('input.getSize propertychange.getSize').on('input.getSize propertychange.getSize', getSize);
                $(window).off('resize.getSize').on('resize.getSize', getSize);
                $(window).off('scroll.getSize').on('scroll.getSize', getSize);
            } else if (this.options.size && this.options.size != 'auto' && menu.find('li'+notDisabled).length > this.options.size) {
                var optIndex = menu.find('li'+notDisabled+' > *').filter(':not(.div-contain)').slice(0,this.options.size).last().parent().index();
                var divLength = menu.find('li').slice(0,optIndex + 1).find('.div-contain').length;
                menuHeight = liHeight*this.options.size + divLength*divHeight + menuPadding;
                if (that.options.dropupAuto) {
                    this.$newElement.toggleClass('dropup', (selectOffsetTop > selectOffsetBot) && (menuHeight < menu.height()));
                }
                menu.css({'max-height' : menuHeight + headerHeight + searchHeight + actionsHeight + 'px', 'overflow' : 'hidden'});
                menuInner.css({'max-height' : menuHeight - menuPadding + 'px', 'overflow-y' : 'auto'});
            }
        },

        setWidth: function() {
            if (this.options.width == 'auto') {
                this.$menu.css('min-width', '0');

                // Get correct width if element hidden
                var selectClone = this.$newElement.clone().appendTo('body');
                var ulWidth = selectClone.find('> .dropdown-menu').css('width');
                var btnWidth = selectClone.css('width', 'auto').find('> button').css('width');
                selectClone.remove();

                // Set width to whatever's larger, button title or longest option
                this.$newElement.css('width', Math.max(parseInt(ulWidth), parseInt(btnWidth)) + 'px');
            } else if (this.options.width == 'fit') {
                // Remove inline min-width so width can be changed from 'auto'
                this.$menu.css('min-width', '');
                this.$newElement.css('width', '').addClass('fit-width');
            } else if (this.options.width) {
                // Remove inline min-width so width can be changed from 'auto'
                this.$menu.css('min-width', '');
                this.$newElement.css('width', this.options.width);
            } else {
                // Remove inline min-width/width so width can be changed
                this.$menu.css('min-width', '');
                this.$newElement.css('width', '');
            }
            // Remove fit-width class if width is changed programmatically
            if (this.$newElement.hasClass('fit-width') && this.options.width !== 'fit') {
                this.$newElement.removeClass('fit-width');
            }
        },

        selectPosition: function() {
            var that = this,
                drop = '<div />',
                $drop = $(drop),
                pos,
                actualHeight,
                getPlacement = function($element) {
                    $drop.addClass($element.attr('class').replace(/form-control/gi, '')).toggleClass('dropup', $element.hasClass('dropup'));
                    pos = $element.offset();
                    actualHeight = $element.hasClass('dropup') ? 0 : $element[0].offsetHeight;
                    $drop.css({'top' : pos.top + actualHeight, 'left' : pos.left, 'width' : $element[0].offsetWidth, 'position' : 'absolute'});
                };
            this.$newElement.on('click', function() {
                if (that.isDisabled()) {
                    return;
                }
                getPlacement($(this));
                $drop.appendTo(that.options.container);
                $drop.toggleClass('open', !$(this).hasClass('open'));
                $drop.append(that.$menu);
            });
            $(window).resize(function() {
                getPlacement(that.$newElement);
            });
            $(window).on('scroll', function() {
                getPlacement(that.$newElement);
            });
            $('html').on('click', function(e) {
                if ($(e.target).closest(that.$newElement).length < 1) {
                    $drop.removeClass('open');
                }
            });
        },

        mobile: function() {
            this.$element.addClass('mobile-device').appendTo(this.$newElement);
            if (this.options.container) this.$menu.hide();
        },

        refresh: function() {
            this.$lis = null;
            this.reloadLi();
            this.render();
            this.setWidth();
            this.setStyle();
            this.checkDisabled();
            this.liHeight();
        },

        update: function() {
            this.reloadLi();
            this.setWidth();
            this.setStyle();
            this.checkDisabled();
            this.liHeight();
        },

        setSelected: function(index, selected) {
            if (this.$lis == null) this.$lis = this.$menu.find('li');
            $(this.$lis[index]).toggleClass('selected', selected);
        },

        setDisabled: function(index, disabled) {
            if (this.$lis == null) this.$lis = this.$menu.find('li');
            if (disabled) {
                $(this.$lis[index]).addClass('disabled').find('a').attr('href', '#').attr('tabindex', -1);
            } else {
                $(this.$lis[index]).removeClass('disabled').find('a').removeAttr('href').attr('tabindex', 0);
            }
        },

        isDisabled: function() {
            return this.$element.is(':disabled');
        },

        checkDisabled: function() {
            var that = this;

            if (this.isDisabled()) {
                this.$button.addClass('disabled').attr('tabindex', -1);
            } else {
                if (this.$button.hasClass('disabled')) {
                    this.$button.removeClass('disabled');
                }

                if (this.$button.attr('tabindex') == -1) {
                    if (!this.$element.data('tabindex')) this.$button.removeAttr('tabindex');
                }
            }

            this.$button.click(function() {
                return !that.isDisabled();
            });
        },

        tabIndex: function() {
            if (this.$element.is('[tabindex]')) {
                this.$element.data('tabindex', this.$element.attr('tabindex'));
                this.$button.attr('tabindex', this.$element.data('tabindex'));
            }
        },

        clickListener: function() {
            var that = this;

            $('body').on('touchstart.dropdown', '.dropdown-menu', function(e) {
                e.stopPropagation();
            });

            this.$newElement.on('click', function() {
                that.setSize();
                if (!that.options.liveSearch && !that.multiple) {
                    setTimeout(function() {
                        that.$menu.find('.selected a').focus();
                    }, 10);
                }
            });

            this.$menu.on('click', 'li a', function(e) {
                var clickedIndex = $(this).parent().index(),
                    prevValue = that.$element.val(),
                    prevIndex = that.$element.prop('selectedIndex');

                //Dont close on multi choice menu
                if (that.multiple) {
                    e.stopPropagation();
                }

                e.preventDefault();

                //Dont run if we have been disabled
                if (!that.isDisabled() && !$(this).parent().hasClass('disabled')) {
                    var $options = that.$element.find('option'),
                        $option = $options.eq(clickedIndex),
                        state = $option.prop('selected'),
                        $optgroup = $option.parent('optgroup'),
                        maxOptions = that.options.maxOptions,
                        maxOptionsGrp = $optgroup.data('maxOptions') || false;

                    //Deselect all others if not multi select box
                    if (!that.multiple) {
                        $options.prop('selected', false);
                        $option.prop('selected', true);
                        that.$menu.find('.selected').removeClass('selected');
                        that.setSelected(clickedIndex, true);
                    }
                    //Else toggle the one we have chosen if we are multi select.
                    else {
                        $option.prop('selected', !state);
                        that.setSelected(clickedIndex, !state);

                        if ((maxOptions !== false) || (maxOptionsGrp !== false)) {
                            var maxReached = maxOptions < $options.filter(':selected').length,
                                maxReachedGrp = maxOptionsGrp < $optgroup.find('option:selected').length,
                                maxOptionsArr = that.options.maxOptionsText,
                                maxTxt = maxOptionsArr[0].replace('{n}', maxOptions),
                                maxTxtGrp = maxOptionsArr[1].replace('{n}', maxOptionsGrp),
                                $notify = $('<div class="notify"></div>');

                            if ((maxOptions && maxReached) || (maxOptionsGrp && maxReachedGrp)) {
                                // If {var} is set in array, replace it
                                if (maxOptionsArr[2]) {
                                    maxTxt = maxTxt.replace('{var}', maxOptionsArr[2][maxOptions > 1 ? 0 : 1]);
                                    maxTxtGrp = maxTxtGrp.replace('{var}', maxOptionsArr[2][maxOptionsGrp > 1 ? 0 : 1]);
                                }

                                $option.prop('selected', false);

                                that.$menu.append($notify);

                                if (maxOptions && maxReached) {
                                    $notify.append($('<div>' + maxTxt + '</div>'));
                                    that.$element.trigger('maxReached.bs.select');
                                }

                                if (maxOptionsGrp && maxReachedGrp) {
                                    $notify.append($('<div>' + maxTxtGrp + '</div>'));
                                    that.$element.trigger('maxReachedGrp.bs.select');
                                }

                                setTimeout(function() {
                                    that.setSelected(clickedIndex, false);
                                }, 10);

                                $notify.delay(750).fadeOut(300, function() { $(this).remove(); });
                            }
                        }
                    }

                    if (!that.multiple) {
                        that.$button.focus();
                    } else if (that.options.liveSearch) {
                        that.$searchbox.focus();
                    }

                    // Trigger select 'change'
                    if ((prevValue != that.$element.val() && that.multiple) || (prevIndex != that.$element.prop('selectedIndex') && !that.multiple)) {
                        that.$element.change();
                    }
                }
            });

            this.$menu.on('click', 'li.disabled a, li dt, li .div-contain, .popover-title, .popover-title :not(.close)', function(e) {
                if (e.target == this) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!that.options.liveSearch) {
                        that.$button.focus();
                    } else {
                        that.$searchbox.focus();
                    }
                }
            });

            this.$menu.on('click', '.popover-title .close', function() {
                that.$button.focus();
            });

            this.$searchbox.on('click', function(e) {
                e.stopPropagation();
            });


            this.$menu.on('click', '.actions-btn', function(e) {
                if (that.options.liveSearch) {
                    that.$searchbox.focus();
                } else {
                    that.$button.focus();
                }

                e.preventDefault();
                e.stopPropagation();

                if ($(this).is('.bs-select-all')) {
                    that.selectAll();
                } else {
                    that.deselectAll();
                }
                that.$element.change();
            });

            this.$element.change(function() {
                that.render(false);
            });
        },

        liveSearchListener: function() {
            var that = this,
                no_results = $('<li class="no-results"></li>');

            this.$newElement.on('click.dropdown.data-api', function() {
                that.$menu.find('.active').removeClass('active');
                if (!!that.$searchbox.val()) {
                    that.$searchbox.val('');
                    that.$lis.not('.is-hidden').removeClass('hide');
                    if (!!no_results.parent().length) no_results.remove();
                }
                if (!that.multiple) that.$menu.find('.selected').addClass('active');
                setTimeout(function() {
                    that.$searchbox.focus();
                }, 10);
            });

            this.$searchbox.on('input propertychange', function() {
                if (that.$searchbox.val()) {
                    that.$lis.not('.is-hidden').removeClass('hide').find('a').not(':icontains(' + that.$searchbox.val() + ')').parent().addClass('hide');

                    if (!that.$menu.find('li').filter(':visible:not(.no-results)').length) {
                        if (!!no_results.parent().length) no_results.remove();
                        no_results.html(that.options.noneResultsText + ' "'+ that.$searchbox.val() + '"').show();
                        that.$menu.find('li').last().after(no_results);
                    } else if (!!no_results.parent().length) {
                        no_results.remove();
                    }

                } else {
                    that.$lis.not('.is-hidden').removeClass('hide');
                    if (!!no_results.parent().length) no_results.remove();
                }

                that.$menu.find('li.active').removeClass('active');
                that.$menu.find('li').filter(':visible:not(.divider)').eq(0).addClass('active').find('a').focus();
                $(this).focus();
            });

            this.$menu.on('mouseenter', 'a', function(e) {
              that.$menu.find('.active').removeClass('active');
              $(e.currentTarget).parent().not('.disabled').addClass('active');
            });

            this.$menu.on('mouseleave', 'a', function() {
              that.$menu.find('.active').removeClass('active');
            });
        },

        val: function(value) {

            if (value !== undefined) {
                this.$element.val( value );

                this.$element.change();
                return this.$element;
            } else {
                return this.$element.val();
            }
        },

        selectAll: function() {
            if (this.$lis == null) this.$lis = this.$menu.find('li');
            this.$element.find('option:enabled').prop('selected', true);
            $(this.$lis).filter(':not(.disabled)').addClass('selected');
            this.render(false);
        },

        deselectAll: function() {
            if (this.$lis == null) this.$lis = this.$menu.find('li');
            this.$element.find('option:enabled').prop('selected', false);
            $(this.$lis).filter(':not(.disabled)').removeClass('selected');
            this.render(false);
        },

        keydown: function(e) {
            var $this,
                $items,
                $parent,
                index,
                next,
                first,
                last,
                prev,
                nextPrev,
                that,
                prevIndex,
                isActive,
                keyCodeMap = {
                    32:' ', 48:'0', 49:'1', 50:'2', 51:'3', 52:'4', 53:'5', 54:'6', 55:'7', 56:'8', 57:'9', 59:';',
                    65:'a', 66:'b', 67:'c', 68:'d', 69:'e', 70:'f', 71:'g', 72:'h', 73:'i', 74:'j', 75:'k', 76:'l',
                    77:'m', 78:'n', 79:'o', 80:'p', 81:'q', 82:'r', 83:'s', 84:'t', 85:'u', 86:'v', 87:'w', 88:'x',
                    89:'y', 90:'z', 96:'0', 97:'1', 98:'2', 99:'3', 100:'4', 101:'5', 102:'6', 103:'7', 104:'8', 105:'9'
                };

            $this = $(this);

            $parent = $this.parent();

            if ($this.is('input')) $parent = $this.parent().parent();

            that = $parent.data('this');

            if (that.options.liveSearch) $parent = $this.parent().parent();

            if (that.options.container) $parent = that.$menu;

            $items = $('[role=menu] li:not(.divider) a', $parent);

            isActive = that.$menu.parent().hasClass('open');

            if (!isActive && /([0-9]|[A-z])/.test(String.fromCharCode(e.keyCode))) {
                if (!that.options.container) {
                    that.setSize();
                    that.$menu.parent().addClass('open');
                    isActive = that.$menu.parent().hasClass('open');
                } else {
                    that.$newElement.trigger('click');
                }
                that.$searchbox.focus();
            }

            if (that.options.liveSearch) {
                if (/(^9$|27)/.test(e.keyCode) && isActive && that.$menu.find('.active').length === 0) {
                    e.preventDefault();
                    that.$menu.parent().removeClass('open');
                    that.$button.focus();
                }
                $items = $('[role=menu] li:not(.divider):visible', $parent);
                if (!$this.val() && !/(38|40)/.test(e.keyCode)) {
                    if ($items.filter('.active').length === 0) {
                        $items = that.$newElement.find('li').filter(':icontains(' + keyCodeMap[e.keyCode] + ')');
                    }
                }
            }

            if (!$items.length) return;

            if (/(38|40)/.test(e.keyCode)) {

                index = $items.index($items.filter(':focus'));
                first = $items.parent(':not(.disabled):visible').first().index();
                last = $items.parent(':not(.disabled):visible').last().index();
                next = $items.eq(index).parent().nextAll(':not(.disabled):visible').eq(0).index();
                prev = $items.eq(index).parent().prevAll(':not(.disabled):visible').eq(0).index();
                nextPrev = $items.eq(next).parent().prevAll(':not(.disabled):visible').eq(0).index();

                if (that.options.liveSearch) {
                    $items.each(function(i) {
                        if ($(this).is(':not(.disabled)')) {
                            $(this).data('index', i);
                        }
                    });
                    index = $items.index($items.filter('.active'));
                    first = $items.filter(':not(.disabled):visible').first().data('index');
                    last = $items.filter(':not(.disabled):visible').last().data('index');
                    next = $items.eq(index).nextAll(':not(.disabled):visible').eq(0).data('index');
                    prev = $items.eq(index).prevAll(':not(.disabled):visible').eq(0).data('index');
                    nextPrev = $items.eq(next).prevAll(':not(.disabled):visible').eq(0).data('index');
                }

                prevIndex = $this.data('prevIndex');

                if (e.keyCode == 38) {
                    if (that.options.liveSearch) index -= 1;
                    if (index != nextPrev && index > prev) index = prev;
                    if (index < first) index = first;
                    if (index == prevIndex) index = last;
                }

                if (e.keyCode == 40) {
                    if (that.options.liveSearch) index += 1;
                    if (index == -1) index = 0;
                    if (index != nextPrev && index < next) index = next;
                    if (index > last) index = last;
                    if (index == prevIndex) index = first;
                }

                $this.data('prevIndex', index);

                if (!that.options.liveSearch) {
                    $items.eq(index).focus();
                } else {
                    e.preventDefault();
                    if (!$this.is('.dropdown-toggle')) {
                        $items.removeClass('active');
                        $items.eq(index).addClass('active').find('a').focus();
                        $this.focus();
                    }
                }

            } else if (!$this.is('input')) {

                var keyIndex = [],
                    count,
                    prevKey;

                $items.each(function() {
                    if ($(this).parent().is(':not(.disabled)')) {
                        if ($.trim($(this).text().toLowerCase()).substring(0,1) == keyCodeMap[e.keyCode]) {
                            keyIndex.push($(this).parent().index());
                        }
                    }
                });

                count = $(document).data('keycount');
                count++;
                $(document).data('keycount',count);

                prevKey = $.trim($(':focus').text().toLowerCase()).substring(0,1);

                if (prevKey != keyCodeMap[e.keyCode]) {
                    count = 1;
                    $(document).data('keycount', count);
                } else if (count >= keyIndex.length) {
                    $(document).data('keycount', 0);
                    if (count > keyIndex.length) count = 1;
                }

                $items.eq(keyIndex[count - 1]).focus();
            }

            // Select focused option if "Enter", "Spacebar", "Tab" are pressed inside the menu.
            if (/(13|32|^9$)/.test(e.keyCode) && isActive) {
                if (!/(32)/.test(e.keyCode)) e.preventDefault();
                if (!that.options.liveSearch) {
                    $(':focus').click();
                } else if (!/(32)/.test(e.keyCode)) {
                    that.$menu.find('.active a').click();
                    $this.focus();
                }
                $(document).data('keycount',0);
            }

            if ((/(^9$|27)/.test(e.keyCode) && isActive && (that.multiple || that.options.liveSearch)) || (/(27)/.test(e.keyCode) && !isActive)) {
                that.$menu.parent().removeClass('open');
                that.$button.focus();
            }

        },

        hide: function() {
            this.$newElement.hide();
        },

        show: function() {
            this.$newElement.show();
        },

        destroy: function() {
            this.$newElement.remove();
            this.$element.remove();
        }
    };

    $.fn.selectpicker = function(option, event) {
       //get the args of the outer function..
       var args = arguments;
       var value;
       var chain = this.each(function() {
            if ($(this).is('select')) {
                var $this = $(this),
                    data = $this.data('selectpicker'),
                    options = typeof option == 'object' && option;

                if (!data) {
                    $this.data('selectpicker', (data = new Selectpicker(this, options, event)));
                } else if (options) {
                    for(var i in options) {
                       data.options[i] = options[i];
                    }
                }

                if (typeof option == 'string') {
                    //Copy the value of option, as once we shift the arguments
                    //it also shifts the value of option.
                    var property = option;
                    if (data[property] instanceof Function) {
                        [].shift.apply(args);
                        value = data[property].apply(data, args);
                    } else {
                        value = data.options[property];
                    }
                }
            }
        });

        if (value !== undefined) {
            return value;
        } else {
            return chain;
        }
    };

    $.fn.selectpicker.defaults = {
        style: 'btn-default',
        size: 'auto',
        title: null,
        selectedTextFormat : 'values',
        noneSelectedText : 'Nothing selected',
        noneResultsText : 'No results match',
        countSelectedText: '{0} of {1} selected',
        maxOptionsText: ['Limit reached ({n} {var} max)', 'Group limit reached ({n} {var} max)', ['items','item']],
        width: false,
        container: false,
        hideDisabled: false,
        showSubtext: false,
        showIcon: true,
        showContent: true,
        dropupAuto: true,
        header: false,
        liveSearch: false,
        actionsBox: false,
        multipleSeparator: ', ',
        iconBase: 'glyphicon',
        tickIcon: 'glyphicon-ok',
        maxOptions: false
    };

    $(document)
        .data('keycount', 0)
        .on('keydown', '.bootstrap-select [data-toggle=dropdown], .bootstrap-select [role=menu], .bootstrap-select-searchbox input', Selectpicker.prototype.keydown)
        .on('focusin.modal', '.bootstrap-select [data-toggle=dropdown], .bootstrap-select [role=menu], .bootstrap-select-searchbox input', function (e) { e.stopPropagation(); });

}(window.jQuery);

/**
* rv-bootstrap-formhelpers.js v2.3.3-rv by @vincentlamanna
* Copyright 2014 
* http://www.apache.org/licenses/LICENSE-2.0
*/
if (!jQuery) { throw new Error("Bootstrap Form Helpers requires jQuery"); }

/* ==========================================================
 * bootstrap-formhelpers-countries.en_US.js
 * https://github.com/vlamanna/BootstrapFormHelpers
 * ==========================================================
 * Copyright 2012 Vincent Lamanna
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */
 
var BFHCountriesList = {
  'AF': 'Afghanistan',
  'AL': 'Albania',
  'DZ': 'Algeria',
  'AS': 'American Samoa',
  'AD': 'Andorra',
  'AO': 'Angola',
  'AI': 'Anguilla',
  'AQ': 'Antarctica',
  'AG': 'Antigua and Barbuda',
  'AR': 'Argentina',
  'AM': 'Armenia',
  'AW': 'Aruba',
  'AU': 'Australia',
  'AT': 'Austria',
  'AZ': 'Azerbaijan',
  'BH': 'Bahrain',
  'BD': 'Bangladesh',
  'BB': 'Barbados',
  'BY': 'Belarus',
  'BE': 'Belgium',
  'BZ': 'Belize',
  'BJ': 'Benin',
  'BM': 'Bermuda',
  'BT': 'Bhutan',
  'BO': 'Bolivia',
  'BA': 'Bosnia and Herzegovina',
  'BW': 'Botswana',
  'BV': 'Bouvet Island',
  'BR': 'Brazil',
  'IO': 'British Indian Ocean Territory',
  'VG': 'British Virgin Islands',
  'BN': 'Brunei',
  'BG': 'Bulgaria',
  'BF': 'Burkina Faso',
  'BI': 'Burundi',
  'CI': 'Côte d\'Ivoire',
  'KH': 'Cambodia',
  'CM': 'Cameroon',
  'CA': 'Canada',
  'CV': 'Cape Verde',
  'KY': 'Cayman Islands',
  'CF': 'Central African Republic',
  'TD': 'Chad',
  'CL': 'Chile',
  'CN': 'China',
  'CX': 'Christmas Island',
  'CC': 'Cocos (Keeling) Islands',
  'CO': 'Colombia',
  'KM': 'Comoros',
  'CG': 'Congo',
  'CK': 'Cook Islands',
  'CR': 'Costa Rica',
  'HR': 'Croatia',
  'CU': 'Cuba',
  'CY': 'Cyprus',
  'CZ': 'Czech Republic',
  'CD': 'Democratic Republic of the Congo',
  'DK': 'Denmark',
  'DJ': 'Djibouti',
  'DM': 'Dominica',
  'DO': 'Dominican Republic',
  'TP': 'East Timor',
  'EC': 'Ecuador',
  'EG': 'Egypt',
  'SV': 'El Salvador',
  'GQ': 'Equatorial Guinea',
  'ER': 'Eritrea',
  'EE': 'Estonia',
  'ET': 'Ethiopia',
  'FO': 'Faeroe Islands',
  'FK': 'Falkland Islands',
  'FJ': 'Fiji',
  'FI': 'Finland',
  'MK': 'Former Yugoslav Republic of Macedonia',
  'FR': 'France',
  'FX': 'France, Metropolitan',
  'GF': 'French Guiana',
  'PF': 'French Polynesia',
  'TF': 'French Southern Territories',
  'GA': 'Gabon',
  'GE': 'Georgia',
  'DE': 'Germany',
  'GH': 'Ghana',
  'GI': 'Gibraltar',
  'GR': 'Greece',
  'GL': 'Greenland',
  'GD': 'Grenada',
  'GP': 'Guadeloupe',
  'GU': 'Guam',
  'GT': 'Guatemala',
  'GN': 'Guinea',
  'GW': 'Guinea-Bissau',
  'GY': 'Guyana',
  'HT': 'Haiti',
  'HM': 'Heard and Mc Donald Islands',
  'HN': 'Honduras',
  'HK': 'Hong Kong',
  'HU': 'Hungary',
  'IS': 'Iceland',
  'IN': 'India',
  'ID': 'Indonesia',
  'IR': 'Iran',
  'IQ': 'Iraq',
  'IE': 'Ireland',
  'IL': 'Israel',
  'IT': 'Italy',
  'JM': 'Jamaica',
  'JP': 'Japan',
  'JO': 'Jordan',
  'KZ': 'Kazakhstan',
  'KE': 'Kenya',
  'KI': 'Kiribati',
  'KW': 'Kuwait',
  'KG': 'Kyrgyzstan',
  'LA': 'Laos',
  'LV': 'Latvia',
  'LB': 'Lebanon',
  'LS': 'Lesotho',
  'LR': 'Liberia',
  'LY': 'Libya',
  'LI': 'Liechtenstein',
  'LT': 'Lithuania',
  'LU': 'Luxembourg',
  'MO': 'Macau',
  'MG': 'Madagascar',
  'MW': 'Malawi',
  'MY': 'Malaysia',
  'MV': 'Maldives',
  'ML': 'Mali',
  'MT': 'Malta',
  'MH': 'Marshall Islands',
  'MQ': 'Martinique',
  'MR': 'Mauritania',
  'MU': 'Mauritius',
  'YT': 'Mayotte',
  'MX': 'Mexico',
  'FM': 'Micronesia',
  'MD': 'Moldova',
  'MC': 'Monaco',
  'MN': 'Mongolia',
  'ME': 'Montenegro',
  'MS': 'Montserrat',
  'MA': 'Morocco',
  'MZ': 'Mozambique',
  'MM': 'Myanmar',
  'NA': 'Namibia',
  'NR': 'Nauru',
  'NP': 'Nepal',
  'NL': 'Netherlands',
  'AN': 'Netherlands Antilles',
  'NC': 'New Caledonia',
  'NZ': 'New Zealand',
  'NI': 'Nicaragua',
  'NE': 'Niger',
  'NG': 'Nigeria',
  'NU': 'Niue',
  'NF': 'Norfolk Island',
  'KP': 'North Korea',
  'MP': 'Northern Marianas',
  'NO': 'Norway',
  'OM': 'Oman',
  'PK': 'Pakistan',
  'PW': 'Palau',
  'PS': 'Palestine',
  'PA': 'Panama',
  'PG': 'Papua New Guinea',
  'PY': 'Paraguay',
  'PE': 'Peru',
  'PH': 'Philippines',
  'PN': 'Pitcairn Islands',
  'PL': 'Poland',
  'PT': 'Portugal',
  'PR': 'Puerto Rico',
  'QA': 'Qatar',
  'RE': 'Reunion',
  'RO': 'Romania',
  'RU': 'Russia',
  'RW': 'Rwanda',
  'ST': 'São Tomé and Príncipe',
  'SH': 'Saint Helena',
  'PM': 'St. Pierre and Miquelon',
  'KN': 'Saint Kitts and Nevis',
  'LC': 'Saint Lucia',
  'VC': 'Saint Vincent and the Grenadines',
  'WS': 'Samoa',
  'SM': 'San Marino',
  'SA': 'Saudi Arabia',
  'SN': 'Senegal',
  'RS': 'Serbia',
  'SC': 'Seychelles',
  'SL': 'Sierra Leone',
  'SG': 'Singapore',
  'SK': 'Slovakia',
  'SI': 'Slovenia',
  'SB': 'Solomon Islands',
  'SO': 'Somalia',
  'ZA': 'South Africa',
  'GS': 'South Georgia and the South Sandwich Islands',
  'KR': 'South Korea',
  'ES': 'Spain',
  'LK': 'Sri Lanka',
  'SD': 'Sudan',
  'SR': 'Suriname',
  'SJ': 'Svalbard and Jan Mayen Islands',
  'SZ': 'Swaziland',
  'SE': 'Sweden',
  'CH': 'Switzerland',
  'SY': 'Syria',
  'TW': 'Taiwan',
  'TJ': 'Tajikistan',
  'TZ': 'Tanzania',
  'TH': 'Thailand',
  'BS': 'The Bahamas',
  'GM': 'The Gambia',
  'TG': 'Togo',
  'TK': 'Tokelau',
  'TO': 'Tonga',
  'TT': 'Trinidad and Tobago',
  'TN': 'Tunisia',
  'TR': 'Turkey',
  'TM': 'Turkmenistan',
  'TC': 'Turks and Caicos Islands',
  'TV': 'Tuvalu',
  'VI': 'US Virgin Islands',
  'UG': 'Uganda',
  'UA': 'Ukraine',
  'AE': 'United Arab Emirates',
  'GB': 'United Kingdom',
  'US': 'United States',
  'UM': 'United States Minor Outlying Islands',
  'UY': 'Uruguay',
  'UZ': 'Uzbekistan',
  'VU': 'Vanuatu',
  'VA': 'Vatican City',
  'VE': 'Venezuela',
  'VN': 'Vietnam',
  'WF': 'Wallis and Futuna Islands',
  'EH': 'Western Sahara',
  'YE': 'Yemen',
  'ZM': 'Zambia',
  'ZW': 'Zimbabwe'
};

 /* ==========================================================
 * bootstrap-formhelpers-currencies.en_US.js
 * https://github.com/vlamanna/BootstrapFormHelpers
 * ==========================================================
 * Copyright 2013 Vincent Lamanna
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */
 
var BFHCurrenciesList = {
  'AED':{'label':'United Arab Emirates dirham','currencyflag':'','symbol':'د.إ'},
  'AFN':{'label':'Afghan afghani','currencyflag':'','symbol':'؋'},
  'ALL':{'label':'Albanian lek','currencyflag':'','symbol':'L'},
  'AMD':{'label':'Armenian dram','currencyflag':'','symbol':'դր'},
  'AOA':{'label':'Angolan kwanza','currencyflag':'','symbol':'Kz'},
  'ARS':{'label':'Argentine peso','currencyflag':'','symbol':'$'},
  'AUD':{'label':'Australian dollar','currencyflag':'AUD','symbol':'$'},
  'AWG':{'label':'Aruban florin','currencyflag':'','symbol':'ƒ'},
  'AZN':{'label':'Azerbaijani manat','currencyflag':'','symbol':''},
  'BAM':{'label':'Bosnia and Herzegovina convertible mark','currencyflag':'','symbol':'KM'},
  'BBD':{'label':'Barbadian dollar','currencyflag':'','symbol':'$'},
  'BDT':{'label':'Bangladeshi taka','currencyflag':'','symbol':'৳'},
  'BGN':{'label':'Bulgarian lev','currencyflag':'','symbol':'лв'},
  'BHD':{'label':'Bahraini dinar','currencyflag':'','symbol':'.د.ب'},
  'BIF':{'label':'Burundian franc','currencyflag':'','symbol':'Fr'},
  'BMD':{'label':'Bermudian dollar','currencyflag':'','symbol':'$'},
  'BND':{'label':'Brunei dollar','currencyflag':'','symbol':'$'},
  'BOB':{'label':'Bolivian boliviano','currencyflag':'','symbol':'Bs'},
  'BRL':{'label':'Brazilian real','currencyflag':'','symbol':'R$'},
  'BSD':{'label':'Bahamian dollar','currencyflag':'','symbol':'$'},
  'BTN':{'label':'Bhutanese ngultrum','currencyflag':'','symbol':'Nu'},
  'BWP':{'label':'Botswana pula','currencyflag':'','symbol':'P'},
  'BYR':{'label':'Belarusian ruble','currencyflag':'','symbol':'Br'},
  'BZD':{'label':'Belize dollar','currencyflag':'','symbol':'$'},
  'CAD':{'label':'Canadian dollar','currencyflag':'','symbol':'$'},
  'CDF':{'label':'Congolese franc','currencyflag':'','symbol':'Fr'},
  'CHF':{'label':'Swiss franc','currencyflag':'CHF','symbol':'Fr'},
  'CLP':{'label':'Chilean peso','currencyflag':'','symbol':'$'},
  'CNY':{'label':'Chinese yuan','currencyflag':'','symbol':'¥'},
  'COP':{'label':'Colombian peso','currencyflag':'','symbol':'$'},
  'CRC':{'label':'Costa Rican colón','currencyflag':'','symbol':'₡'},
  'CUP':{'label':'Cuban convertible peso','currencyflag':'','symbol':'$'},
  'CVE':{'label':'Cape Verdean escudo','currencyflag':'','symbol':'$'},
  'CZK':{'label':'Czech koruna','currencyflag':'','symbol':'Kč'},
  'DJF':{'label':'Djiboutian franc','currencyflag':'','symbol':'Fr'},
  'DKK':{'label':'Danish krone','currencyflag':'DKK','symbol':'kr'},
  'DOP':{'label':'Dominican peso','currencyflag':'','symbol':'$'},
  'DZD':{'label':'Algerian dinar','currencyflag':'','symbol':'د.ج'},
  'EGP':{'label':'Egyptian pound','currencyflag':'','symbol':'ج.م'},
  'ERN':{'label':'Eritrean nakfa','currencyflag':'','symbol':'Nfk'},
  'ETB':{'label':'Ethiopian birr','currencyflag':'','symbol':'Br'},
  'EUR':{'label':'Euro','currencyflag':'EUR','symbol':'€'},
  'FJD':{'label':'Fijian dollar','currencyflag':'','symbol':'$'},
  'FKP':{'label':'Falkland Islands pound','currencyflag':'','symbol':'£'},
  'GBP':{'label':'British pound','currencyflag':'','symbol':'£'},
  'GEL':{'label':'Georgian lari','currencyflag':'','symbol':'ლ'},
  'GHS':{'label':'Ghana cedi','currencyflag':'','symbol':'₵'},
  'GMD':{'label':'Gambian dalasi','currencyflag':'','symbol':'D'},
  'GNF':{'label':'Guinean franc','currencyflag':'','symbol':'Fr'},
  'GTQ':{'label':'Guatemalan quetzal','currencyflag':'','symbol':'Q'},
  'GYD':{'label':'Guyanese dollar','currencyflag':'','symbol':'$'},
  'HKD':{'label':'Hong Kong dollar','currencyflag':'','symbol':'$'},
  'HNL':{'label':'Honduran lempira','currencyflag':'','symbol':'L'},
  'HRK':{'label':'Croatian kuna','currencyflag':'','symbol':'kn'},
  'HTG':{'label':'Haitian gourde','currencyflag':'','symbol':'G'},
  'HUF':{'label':'Hungarian forint','currencyflag':'','symbol':'Ft'},
  'IDR':{'label':'Indonesian rupiah','currencyflag':'','symbol':'Rp'},
  'ILS':{'label':'Israeli new shekel','currencyflag':'','symbol':'₪'},
  'IMP':{'label':'Manx pound','currencyflag':'','symbol':'£'},
  'INR':{'label':'Indian rupee','currencyflag':'','symbol':''},
  'IQD':{'label':'Iraqi dinar','currencyflag':'','symbol':'ع.د'},
  'IRR':{'label':'Iranian rial','currencyflag':'','symbol':'﷼'},
  'ISK':{'label':'Icelandic króna','currencyflag':'','symbol':'kr'},
  'JEP':{'label':'Jersey pound','currencyflag':'','symbol':'£'},
  'JMD':{'label':'Jamaican dollar','currencyflag':'','symbol':'$'},
  'JOD':{'label':'Jordanian dinar','currencyflag':'','symbol':'د.ا'},
  'JPY':{'label':'Japanese yen','currencyflag':'','symbol':'¥'},
  'KES':{'label':'Kenyan shilling','currencyflag':'','symbol':'Sh'},
  'KGS':{'label':'Kyrgyzstani som','currencyflag':'','symbol':'лв'},
  'KHR':{'label':'Cambodian riel','currencyflag':'','symbol':'៛'},
  'KMF':{'label':'Comorian franc','currencyflag':'','symbol':'Fr'},
  'KPW':{'label':'North Korean won','currencyflag':'','symbol':'₩'},
  'KRW':{'label':'South Korean won','currencyflag':'','symbol':'₩'},
  'KWD':{'label':'Kuwaiti dinar','currencyflag':'','symbol':'د.ك'},
  'KYD':{'label':'Cayman Islands dollar','currencyflag':'','symbol':'$'},
  'KZT':{'label':'Kazakhstani tenge','currencyflag':'','symbol':'₸'},
  'LAK':{'label':'Lao kip','currencyflag':'','symbol':'₭'},
  'LBP':{'label':'Lebanese pound','currencyflag':'','symbol':'ل.ل'},
  'LKR':{'label':'Sri Lankan rupee','currencyflag':'','symbol':'Rs'},
  'LRD':{'label':'Liberian dollar','currencyflag':'','symbol':'$'},
  'LSL':{'label':'Lesotho loti','currencyflag':'','symbol':'L'},
  'LTL':{'label':'Lithuanian litas','currencyflag':'','symbol':'Lt'},
  'LVL':{'label':'Latvian lats','currencyflag':'','symbol':'Ls'},
  'LYD':{'label':'Libyan dinar','currencyflag':'','symbol':'ل.د'},
  'MAD':{'label':'Moroccan dirham','currencyflag':'','symbol':'د.م.'},
  'MDL':{'label':'Moldovan leu','currencyflag':'','symbol':'L'},
  'MGA':{'label':'Malagasy ariary','currencyflag':'','symbol':'Ar'},
  'MKD':{'label':'Macedonian denar','currencyflag':'','symbol':'ден'},
  'MMK':{'label':'Burmese kyat','currencyflag':'','symbol':'Ks'},
  'MNT':{'label':'Mongolian tögrög','currencyflag':'','symbol':'₮'},
  'MOP':{'label':'Macanese pataca','currencyflag':'','symbol':'P'},
  'MRO':{'label':'Mauritanian ouguiya','currencyflag':'','symbol':'UM'},
  'MUR':{'label':'Mauritian rupee','currencyflag':'','symbol':'Rs'},
  'MVR':{'label':'Maldivian rufiyaa','currencyflag':'','symbol':'.ރ'},
  'MWK':{'label':'Malawian kwacha','currencyflag':'','symbol':'MK'},
  'MXN':{'label':'Mexican peso','currencyflag':'','symbol':'$'},
  'MYR':{'label':'Malaysian ringgit','currencyflag':'','symbol':'MR'},
  'MZN':{'label':'Mozambican metical','currencyflag':'','symbol':'MT'},
  'NAD':{'label':'Namibian dollar','currencyflag':'','symbol':'$'},
  'NGN':{'label':'Nigerian naira','currencyflag':'','symbol':'₦'},
  'NIO':{'label':'Nicaraguan córdoba','currencyflag':'','symbol':'C$'},
  'NOK':{'label':'Norwegian krone','currencyflag':'','symbol':'kr'},
  'NPR':{'label':'Nepalese rupee','currencyflag':'','symbol':'Rs'},
  'NZD':{'label':'New Zealand dollar','currencyflag':'','symbol':'$'},
  'OMR':{'label':'Omani rial','currencyflag':'','symbol':'ر.ع.'},
  'PAB':{'label':'Panamanian balboa','currencyflag':'','symbol':'B/.'},
  'PEN':{'label':'Peruvian nuevo sol','currencyflag':'','symbol':'S/.'},
  'PGK':{'label':'Papua New Guinean kina','currencyflag':'','symbol':'K'},
  'PHP':{'label':'Philippine peso','currencyflag':'','symbol':'₱'},
  'PKR':{'label':'Pakistani rupee','currencyflag':'','symbol':'Rs'},
  'PLN':{'label':'Polish złoty','currencyflag':'','symbol':'zł'},
  'PRB':{'label':'Transnistrian ruble','currencyflag':'','symbol':'р.'},
  'PYG':{'label':'Paraguayan guaraní','currencyflag':'','symbol':'₲'},
  'QAR':{'label':'Qatari riyal','currencyflag':'','symbol':'ر.ق'},
  'RON':{'label':'Romanian leu','currencyflag':'','symbol':'L'},
  'RSD':{'label':'Serbian dinar','currencyflag':'','symbol':'дин'},
  'RUB':{'label':'Russian ruble','currencyflag':'','symbol':'руб.'},
  'RWF':{'label':'Rwandan franc','currencyflag':'','symbol':'Fr'},
  'SAR':{'label':'Saudi riyal','currencyflag':'','symbol':'ر.س'},
  'SBD':{'label':'Solomon Islands dollar','currencyflag':'','symbol':'$'},
  'SCR':{'label':'Seychellois rupee','currencyflag':'','symbol':'Rs'},
  'SDG':{'label':'Singapore dollar','currencyflag':'','symbol':'$'},
  'SEK':{'label':'Swedish krona','currencyflag':'','symbol':'kr'},
  'SGD':{'label':'Singapore dollar','currencyflag':'','symbol':'$'},
  'SHP':{'label':'Saint Helena pound','currencyflag':'','symbol':'£'},
  'SLL':{'label':'Sierra Leonean leone','currencyflag':'','symbol':'Le'},
  'SOS':{'label':'Somali shilling','currencyflag':'','symbol':'Sh'},
  'SRD':{'label':'Surinamese dollar','currencyflag':'','symbol':'$'},
  'SSP':{'label':'South Sudanese pound','currencyflag':'','symbol':'£'},
  'STD':{'label':'São Tomé and Príncipe dobra','currencyflag':'','symbol':'Db'},
  'SVC':{'label':'Salvadoran colón','currencyflag':'','symbol':'₡'},
  'SYP':{'label':'Syrian pound','currencyflag':'','symbol':'£'},
  'SZL':{'label':'Swazi lilangeni','currencyflag':'','symbol':'L'},
  'THB':{'label':'Thai baht','currencyflag':'','symbol':'฿'},
  'TJS':{'label':'Tajikistani somoni','currencyflag':'','symbol':'SM'},
  'TMT':{'label':'Turkmenistan manat','currencyflag':'','symbol':'m'},
  'TND':{'label':'Tunisian dinar','currencyflag':'','symbol':'د.ت'},
  'TOP':{'label':'Tongan paʻanga','currencyflag':'','symbol':'T$'},
  'TRY':{'label':'Turkish lira','currencyflag':'','symbol':'&#8378;'},
  'TTD':{'label':'Trinidad and Tobago dollar','currencyflag':'','symbol':'$'},
  'TWD':{'label':'New Taiwan dollar','currencyflag':'','symbol':'$'},
  'TZS':{'label':'Tanzanian shilling','currencyflag':'','symbol':'Sh'},
  'UAH':{'label':'Ukrainian hryvnia','currencyflag':'','symbol':'₴'},
  'UGX':{'label':'Ugandan shilling','currencyflag':'','symbol':'Sh'},
  'USD':{'label':'United States dollar','currencyflag':'','symbol':'$'},
  'UYU':{'label':'Uruguayan peso','currencyflag':'','symbol':'$'},
  'UZS':{'label':'Uzbekistani som','currencyflag':'','symbol':'лв'},
  'VEF':{'label':'Venezuelan bolívar','currencyflag':'','symbol':'Bs F'},
  'VND':{'label':'Vietnamese đồng','currencyflag':'','symbol':'₫'},
  'VUV':{'label':'Vanuatu vatu','currencyflag':'','symbol':'Vt'},
  'WST':{'label':'Samoan tālā','currencyflag':'','symbol':'T'},
  'XAF':{'label':'Central African CFA franc','currencyflag':'XAF','symbol':'Fr'},
  'XCD':{'label':'East Caribbean dollar','currencyflag':'XCD','symbol':'$'},
  'XOF':{'label':'West African CFA franc','currencyflag':'XOF','symbol':'Fr'},
  'XPF':{'label':'CFP franc','currencyflag':'XPF','symbol':'Fr'},
  'YER':{'label':'Yemeni rial','currencyflag':'','symbol':'﷼'},
  'ZAR':{'label':'South African rand','currencyflag':'ZAR','symbol':'R'},
  'ZMW':{'label':'Zambian kwacha','currencyflag':'','symbol':'ZK'},
  'ZWL':{'label':'Zimbabwean dollar','currencyflag':'','symbol':'$'}
};

/* ==========================================================
 * bootstrap-formhelpers-datepicker.en_US.js
 * https://github.com/vlamanna/BootstrapFormHelpers
 * ==========================================================
 * Copyright 2012 Vincent Lamanna
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */
 
var BFHMonthsList = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];
 
var BFHDaysList = [
  'SUN',
  'MON',
  'TUE',
  'WED',
  'THU',
  'FRI',
  'SAT'
];
 
var BFHDayOfWeekStart = 0;

/* ==========================================================
 * bootstrap-formhelpers-fonts.en_US.js
 * https://github.com/vlamanna/BootstrapFormHelpers
 * ==========================================================
 * Copyright 2012 Vincent Lamanna
 *
 * Licensed under the Apache License, Version 2.0 (the "License")
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */
 
var BFHFontsList = {
  'Andale Mono': '"Andale Mono", AndaleMono, monospace',
  'Arial': 'Arial, "Helvetica Neue", Helvetica, sans-serif',
  'Arial Black': '"Arial Black", "Arial Bold", Gadget, sans-serif',
  'Arial Narrow': '"Arial Narrow", Arial, sans-serif',
  'Arial Rounded MT Bold': '"Arial Rounded MT Bold", "Helvetica Rounded", Arial, sans-serif',
  'Avant Garde': '"Avant Garde", Avantgarde, "Century Gothic", CenturyGothic, "AppleGothic", sans-serif',
  'Baskerville': 'Baskerville, "Baskerville Old Face", "Hoefler Text", Garamond, "Times New Roman", serif',
  'Big Caslon': '"Big Caslon", "Book Antiqua", "Palatino Linotype", Georgia, serif',
  'Bodoni MT': '"Bodoni MT", Didot, "Didot LT STD", "Hoefler Text", Garamond, "Times New Roman", serif',
  'Book Antiqua': '"Book Antiqua", Palatino, "Palatino Linotype", "Palatino LT STD", Georgia, serif',
  'Brush Script MT': '"Brush Script MT", cursive',
  'Calibri': 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif',
  'Calisto MT': '"Calisto MT", "Bookman Old Style", Bookman, "Goudy Old Style", Garamond, "Hoefler Text", "Bitstream Charter", Georgia, serif',
  'Cambrio': 'Cambria, Georgia, serif',
  'Candara': 'Candara, Calibri, Segoe, "Segoe UI", Optima, Arial, sans-serif',
  'Century Gothic': '"Century Gothic", CenturyGothic, AppleGothic, sans-serif',
  'Consolas': 'Consolas, monaco, monospace',
  'Copperplate': 'Copperplate, "Copperplate Gothic Light", fantasy',
  'Courier New': '"Courier New", Courier, "Lucida Sans Typewriter", "Lucida Typewriter", monospace',
  'Didot': 'Didot, "Didot LT STD", "Hoefler Text", Garamond, "Times New Roman", serif',
  'Franklin Gothic Medium': '"Franklin Gothic Medium", "Franklin Gothic", "ITC Franklin Gothic", Arial, sans-serif',
  'Futura': 'Futura, "Trebuchet MS", Arial, sans-serif',
  'Garamond': 'Garamond, Baskerville, "Baskerville Old Face", "Hoefler Text", "Times New Roman", serif',
  'Geneva': 'Geneva, Tahoma, Verdana, sans-serif',
  'Georgia': 'Georgia, Times, "Times New Roman", serif',
  'Gill Sans': '"Gill Sans", "Gill Sans MT", Calibri, sans-serif',
  'Goudy Old Style': '"Goudy Old Style", Garamond, "Big Caslon", "Times New Roman", serif',
  'Helvetica': '"Helvetica Neue", Helvetica, Arial, sans-serif',
  'Hoefler Text': '"Hoefler Text", "Baskerville old face", Garamond, "Times New Roman", serif',
  'Impact': 'Impact, Haettenschweiler, "Franklin Gothic Bold", Charcoal, "Helvetica Inserat", "Bitstream Vera Sans Bold", "Arial Black", sans serif',
  'Lucida Bright': '"Lucida Bright", Georgia, serif',
  'Lucida Console': '"Lucida Console", "Lucida Sans Typewriter", Monaco, "Bitstream Vera Sans Mono", monospace',
  'Lucida Sans Typewriter': '"Lucida Sans Typewriter", "Lucida Console", Monaco, "Bitstream Vera Sans Mono", monospace',
  'Lucida Grande': '"Lucida Grande", "Lucida Sans Unicode", "Lucida Sans", Geneva, Verdana, sans-serif',
  'Monaco': 'Monaco, Consolas, "Lucida Console", monospace',
  'Optima': 'Optima, Segoe, "Segoe UI", Candara, Calibri, Arial, sans-serif',
  'Palatino': 'Palatino, "Palatino Linotype", "Palatino LT STD", "Book Antiqua", Georgia, serif',
  'Papyrus': 'Papyrus, fantasy',
  'Perpetua': 'Perpetua, Baskerville, "Big Caslon", "Palatino Linotype", Palatino, "URW Palladio L", "Nimbus Roman No9 L", serif',
  'Rockwell': 'Rockwell, "Courier Bold", Courier, Georgia, Times, "Times New Roman", serif',
  'Rockwell Extra Bold': '"Rockwell Extra Bold", "Rockwell Bold", monospace',
  'Segoe UI': '"Segoe UI", Frutiger, "Frutiger Linotype',
  'Tahoma': 'Tahoma, Verdana, Segoe, sans-serif',
  'Times New Roman': 'TimesNewRoman, "Times New Roman", Times, Baskerville, Georgia, serif',
  'Trebuchet MS': '"Trebuchet MS", "Lucida Grande", "Lucida Sans Unicode", "Lucida Sans", Tahoma, sans-serif',
  'Verdana': 'Verdana, Geneva, sans-serif'
};

/* ==========================================================
 * bootstrap-formhelpers-fontsizes.en_US.js
 * https://github.com/vlamanna/BootstrapFormHelpers
 * ==========================================================
 * Copyright 2012 Vincent Lamanna
 *
 * Licensed under the Apache License, Version 2.0 (the 'License')
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */

/* Donna - Modified font sizes. */
var BFHFontSizesList = {
	8: '8',
	9: '9',
	10: '10',
	11: '11',
	12: '12',
	14: '14',
	18: '18',
	24: '24',
	30: '30',
	36: '36',
	48: '48',
	60: '60',
	72: '72',
	96: '96'
};

/* ==========================================================
 * bootstrap-formhelpers-googlefonts.en_US.js
 * https://github.com/vlamanna/BootstrapFormHelpers
 * ==========================================================
 * Copyright 2012 Vincent Lamanna
 * contributed by Aaron Collegeman, Squidoo, 2012
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */

var BFHGoogleFontsList = {
  'kind': 'webfonts#webfontList',
  'items': [
    {
      'kind': 'webfonts#webfont',
      'family': 'ABeeZee',
      'variants': [
        'regular',
        'italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Abel',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Abril Fatface',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Aclonica',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Acme',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Actor',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Adamina',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Advent Pro',
      'variants': [
        '100',
        '200',
        '300',
        'regular',
        '500',
        '600',
        '700'
      ],
      'subsets': [
        'latin-ext',
        'latin',
        'greek'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Aguafina Script',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Akronim',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Aladin',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Aldrich',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Alegreya',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic',
        '900',
        '900italic'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Alegreya SC',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic',
        '900',
        '900italic'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Alex Brush',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Alfa Slab One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Alice',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Alike',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Alike Angular',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Allan',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Allerta',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Allerta Stencil',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Allura',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Almendra',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Almendra Display',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Almendra SC',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Amarante',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Amaranth',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Amatic SC',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Amethysta',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Anaheim',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Andada',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Andika',
      'variants': [
        'regular'
      ],
      'subsets': [
        'cyrillic',
        'latin-ext',
        'latin',
        'cyrillic-ext'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Angkor',
      'variants': [
        'regular'
      ],
      'subsets': [
        'khmer'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Annie Use Your Telescope',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Anonymous Pro',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'cyrillic',
        'greek-ext',
        'latin-ext',
        'latin',
        'greek',
        'cyrillic-ext'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Antic',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Antic Didone',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Antic Slab',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Anton',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Arapey',
      'variants': [
        'regular',
        'italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Arbutus',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Arbutus Slab',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Architects Daughter',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Archivo Black',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Archivo Narrow',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Arimo',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Arizonia',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Armata',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Artifika',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Arvo',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Asap',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Asset',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Astloch',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Asul',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Atomic Age',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Aubrey',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Audiowide',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Autour One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Average',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Average Sans',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Averia Gruesa Libre',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Averia Libre',
      'variants': [
        '300',
        '300italic',
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Averia Sans Libre',
      'variants': [
        '300',
        '300italic',
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Averia Serif Libre',
      'variants': [
        '300',
        '300italic',
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Bad Script',
      'variants': [
        'regular'
      ],
      'subsets': [
        'cyrillic',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Balthazar',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Bangers',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Basic',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Battambang',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'khmer'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Baumans',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Bayon',
      'variants': [
        'regular'
      ],
      'subsets': [
        'khmer'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Belgrano',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Belleza',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'BenchNine',
      'variants': [
        '300',
        'regular',
        '700'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Bentham',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Berkshire Swash',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Bevan',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Bigelow Rules',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Bigshot One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Bilbo',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Bilbo Swash Caps',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Bitter',
      'variants': [
        'regular',
        'italic',
        '700'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Black Ops One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Bokor',
      'variants': [
        'regular'
      ],
      'subsets': [
        'khmer'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Bonbon',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Boogaloo',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Bowlby One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Bowlby One SC',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Brawler',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Bree Serif',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Bubblegum Sans',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Bubbler One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Buda',
      'variants': [
        '300'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Buenard',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Butcherman',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Butterfly Kids',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Cabin',
      'variants': [
        'regular',
        'italic',
        '500',
        '500italic',
        '600',
        '600italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Cabin Condensed',
      'variants': [
        'regular',
        '500',
        '600',
        '700'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Cabin Sketch',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Caesar Dressing',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Cagliostro',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Calligraffitti',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Cambo',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Candal',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Cantarell',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Cantata One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Cantora One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Capriola',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Cardo',
      'variants': [
        'regular',
        'italic',
        '700'
      ],
      'subsets': [
        'greek-ext',
        'latin-ext',
        'latin',
        'greek'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Carme',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Carrois Gothic',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Carrois Gothic SC',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Carter One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Caudex',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'greek-ext',
        'latin-ext',
        'latin',
        'greek'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Cedarville Cursive',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Ceviche One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Changa One',
      'variants': [
        'regular',
        'italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Chango',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Chau Philomene One',
      'variants': [
        'regular',
        'italic'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Chela One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Chelsea Market',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Chenla',
      'variants': [
        'regular'
      ],
      'subsets': [
        'khmer'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Cherry Cream Soda',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Cherry Swash',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Chewy',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Chicle',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Chivo',
      'variants': [
        'regular',
        'italic',
        '900',
        '900italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Cinzel',
      'variants': [
        'regular',
        '700',
        '900'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Cinzel Decorative',
      'variants': [
        'regular',
        '700',
        '900'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Clicker Script',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Coda',
      'variants': [
        'regular',
        '800'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Coda Caption',
      'variants': [
        '800'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Codystar',
      'variants': [
        '300',
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Combo',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Comfortaa',
      'variants': [
        '300',
        'regular',
        '700'
      ],
      'subsets': [
        'cyrillic',
        'latin-ext',
        'latin',
        'greek',
        'cyrillic-ext'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Coming Soon',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Concert One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Condiment',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Content',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'khmer'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Contrail One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Convergence',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Cookie',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Copse',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Corben',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Courgette',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Cousine',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Coustard',
      'variants': [
        'regular',
        '900'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Covered By Your Grace',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Crafty Girls',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Creepster',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Crete Round',
      'variants': [
        'regular',
        'italic'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Crimson Text',
      'variants': [
        'regular',
        'italic',
        '600',
        '600italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Croissant One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Crushed',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Cuprum',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'cyrillic',
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Cutive',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Cutive Mono',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Damion',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Dancing Script',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Dangrek',
      'variants': [
        'regular'
      ],
      'subsets': [
        'khmer'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Dawning of a New Day',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Days One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Delius',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Delius Swash Caps',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Delius Unicase',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Della Respira',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Devonshire',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Didact Gothic',
      'variants': [
        'regular'
      ],
      'subsets': [
        'cyrillic',
        'greek-ext',
        'latin-ext',
        'latin',
        'greek',
        'cyrillic-ext'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Diplomata',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Diplomata SC',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Doppio One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Dorsa',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Dosis',
      'variants': [
        '200',
        '300',
        'regular',
        '500',
        '600',
        '700',
        '800'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Dr Sugiyama',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Droid Sans',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Droid Sans Mono',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Droid Serif',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Duru Sans',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Dynalight',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'EB Garamond',
      'variants': [
        'regular'
      ],
      'subsets': [
        'cyrillic',
        'latin-ext',
        'latin',
        'vietnamese',
        'cyrillic-ext'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Eagle Lake',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Eater',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Economica',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Electrolize',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Emblema One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Emilys Candy',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Engagement',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Englebert',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Enriqueta',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Erica One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Esteban',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Euphoria Script',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Ewert',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Exo',
      'variants': [
        '100',
        '100italic',
        '200',
        '200italic',
        '300',
        '300italic',
        'regular',
        'italic',
        '500',
        '500italic',
        '600',
        '600italic',
        '700',
        '700italic',
        '800',
        '800italic',
        '900',
        '900italic'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Expletus Sans',
      'variants': [
        'regular',
        'italic',
        '500',
        '500italic',
        '600',
        '600italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Fanwood Text',
      'variants': [
        'regular',
        'italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Fascinate',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Fascinate Inline',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Faster One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Fasthand',
      'variants': [
        'regular'
      ],
      'subsets': [
        'khmer'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Federant',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Federo',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Felipa',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Fenix',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Finger Paint',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Fjord One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Flamenco',
      'variants': [
        '300',
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Flavors',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Fondamento',
      'variants': [
        'regular',
        'italic'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Fontdiner Swanky',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Forum',
      'variants': [
        'regular'
      ],
      'subsets': [
        'cyrillic',
        'latin-ext',
        'latin',
        'cyrillic-ext'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Francois One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Freckle Face',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Fredericka the Great',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Fredoka One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Freehand',
      'variants': [
        'regular'
      ],
      'subsets': [
        'khmer'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Fresca',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Frijole',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Fugaz One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'GFS Didot',
      'variants': [
        'regular'
      ],
      'subsets': [
        'greek'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'GFS Neohellenic',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'greek'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Gafata',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Galdeano',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Galindo',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Gentium Basic',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Gentium Book Basic',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Geo',
      'variants': [
        'regular',
        'italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Geostar',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Geostar Fill',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Germania One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Gilda Display',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Give You Glory',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Glass Antiqua',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Glegoo',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Gloria Hallelujah',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Goblin One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Gochi Hand',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Gorditas',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Goudy Bookletter 1911',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Graduate',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Gravitas One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Great Vibes',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Griffy',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Gruppo',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Gudea',
      'variants': [
        'regular',
        'italic',
        '700'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Habibi',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Hammersmith One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Hanalei',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Hanalei Fill',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Handlee',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Hanuman',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'khmer'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Happy Monkey',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Headland One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Henny Penny',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Herr Von Muellerhoff',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Holtwood One SC',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Homemade Apple',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Homenaje',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'IM Fell DW Pica',
      'variants': [
        'regular',
        'italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'IM Fell DW Pica SC',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'IM Fell Double Pica',
      'variants': [
        'regular',
        'italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'IM Fell Double Pica SC',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'IM Fell English',
      'variants': [
        'regular',
        'italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'IM Fell English SC',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'IM Fell French Canon',
      'variants': [
        'regular',
        'italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'IM Fell French Canon SC',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'IM Fell Great Primer',
      'variants': [
        'regular',
        'italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'IM Fell Great Primer SC',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Iceberg',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Iceland',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Imprima',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Inconsolata',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Inder',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Indie Flower',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Inika',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Irish Grover',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Istok Web',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'cyrillic',
        'latin-ext',
        'latin',
        'cyrillic-ext'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Italiana',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Italianno',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Jacques Francois',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Jacques Francois Shadow',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Jim Nightshade',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Jockey One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Jolly Lodger',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Josefin Sans',
      'variants': [
        '100',
        '100italic',
        '300',
        '300italic',
        'regular',
        'italic',
        '600',
        '600italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Josefin Slab',
      'variants': [
        '100',
        '100italic',
        '300',
        '300italic',
        'regular',
        'italic',
        '600',
        '600italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Joti One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Judson',
      'variants': [
        'regular',
        'italic',
        '700'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Julee',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Julius Sans One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Junge',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Jura',
      'variants': [
        '300',
        'regular',
        '500',
        '600'
      ],
      'subsets': [
        'cyrillic',
        'greek-ext',
        'latin-ext',
        'latin',
        'greek',
        'cyrillic-ext'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Just Another Hand',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Just Me Again Down Here',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Kameron',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Karla',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Kaushan Script',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Keania One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Kelly Slab',
      'variants': [
        'regular'
      ],
      'subsets': [
        'cyrillic',
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Kenia',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Khmer',
      'variants': [
        'regular'
      ],
      'subsets': [
        'khmer'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Kite One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Knewave',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Kotta One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Koulen',
      'variants': [
        'regular'
      ],
      'subsets': [
        'khmer'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Kranky',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Kreon',
      'variants': [
        '300',
        'regular',
        '700'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Kristi',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Krona One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'La Belle Aurore',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Lancelot',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Lato',
      'variants': [
        '100',
        '100italic',
        '300',
        '300italic',
        'regular',
        'italic',
        '700',
        '700italic',
        '900',
        '900italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'League Script',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Leckerli One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Ledger',
      'variants': [
        'regular'
      ],
      'subsets': [
        'cyrillic',
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Lekton',
      'variants': [
        'regular',
        'italic',
        '700'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Lemon',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Life Savers',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Lilita One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Limelight',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Linden Hill',
      'variants': [
        'regular',
        'italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Lobster',
      'variants': [
        'regular'
      ],
      'subsets': [
        'cyrillic',
        'latin-ext',
        'latin',
        'cyrillic-ext'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Lobster Two',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Londrina Outline',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Londrina Shadow',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Londrina Sketch',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Londrina Solid',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Lora',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Love Ya Like A Sister',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Loved by the King',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Lovers Quarrel',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Luckiest Guy',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Lusitana',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Lustria',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Macondo',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Macondo Swash Caps',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Magra',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Maiden Orange',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Mako',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Marcellus',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Marcellus SC',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Marck Script',
      'variants': [
        'regular'
      ],
      'subsets': [
        'cyrillic',
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Margarine',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Marko One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Marmelad',
      'variants': [
        'regular'
      ],
      'subsets': [
        'cyrillic',
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Marvel',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Mate',
      'variants': [
        'regular',
        'italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Mate SC',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Maven Pro',
      'variants': [
        'regular',
        '500',
        '700',
        '900'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'McLaren',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Meddon',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'MedievalSharp',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Medula One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Megrim',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Meie Script',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Merienda',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Merienda One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Merriweather',
      'variants': [
        '300',
        'regular',
        '700',
        '900'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Metal',
      'variants': [
        'regular'
      ],
      'subsets': [
        'khmer'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Metal Mania',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Metamorphous',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Metrophobic',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Michroma',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Miltonian',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Miltonian Tattoo',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Miniver',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Miss Fajardose',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Modern Antiqua',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Molengo',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Molle',
      'variants': [
        'italic'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Monofett',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Monoton',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Monsieur La Doulaise',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Montaga',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Montez',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Montserrat',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Montserrat Alternates',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Montserrat Subrayada',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Moul',
      'variants': [
        'regular'
      ],
      'subsets': [
        'khmer'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Moulpali',
      'variants': [
        'regular'
      ],
      'subsets': [
        'khmer'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Mountains of Christmas',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Mouse Memoirs',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Mr Bedfort',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Mr Dafoe',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Mr De Haviland',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Mrs Saint Delafield',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Mrs Sheppards',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Muli',
      'variants': [
        '300',
        '300italic',
        'regular',
        'italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Mystery Quest',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Neucha',
      'variants': [
        'regular'
      ],
      'subsets': [
        'cyrillic',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Neuton',
      'variants': [
        '200',
        '300',
        'regular',
        'italic',
        '700',
        '800'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'News Cycle',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Niconne',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Nixie One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Nobile',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Nokora',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'khmer'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Norican',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Nosifer',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Nothing You Could Do',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Noticia Text',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin-ext',
        'latin',
        'vietnamese'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Nova Cut',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Nova Flat',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Nova Mono',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin',
        'greek'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Nova Oval',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Nova Round',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Nova Script',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Nova Slim',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Nova Square',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Numans',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Nunito',
      'variants': [
        '300',
        'regular',
        '700'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Odor Mean Chey',
      'variants': [
        'regular'
      ],
      'subsets': [
        'khmer'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Offside',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Old Standard TT',
      'variants': [
        'regular',
        'italic',
        '700'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Oldenburg',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Oleo Script',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Oleo Script Swash Caps',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Open Sans',
      'variants': [
        '300',
        '300italic',
        'regular',
        'italic',
        '600',
        '600italic',
        '700',
        '700italic',
        '800',
        '800italic'
      ],
      'subsets': [
        'cyrillic',
        'greek-ext',
        'latin-ext',
        'latin',
        'vietnamese',
        'greek',
        'cyrillic-ext'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Open Sans Condensed',
      'variants': [
        '300',
        '300italic',
        '700'
      ],
      'subsets': [
        'cyrillic',
        'greek-ext',
        'latin-ext',
        'latin',
        'vietnamese',
        'greek',
        'cyrillic-ext'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Oranienbaum',
      'variants': [
        'regular'
      ],
      'subsets': [
        'cyrillic',
        'latin-ext',
        'latin',
        'cyrillic-ext'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Orbitron',
      'variants': [
        'regular',
        '500',
        '700',
        '900'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Oregano',
      'variants': [
        'regular',
        'italic'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Orienta',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Original Surfer',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Oswald',
      'variants': [
        '300',
        'regular',
        '700'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Over the Rainbow',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Overlock',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic',
        '900',
        '900italic'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Overlock SC',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Ovo',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Oxygen',
      'variants': [
        '300',
        'regular',
        '700'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Oxygen Mono',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'PT Mono',
      'variants': [
        'regular'
      ],
      'subsets': [
        'cyrillic',
        'latin-ext',
        'latin',
        'cyrillic-ext'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'PT Sans',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'cyrillic',
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'PT Sans Caption',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'cyrillic',
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'PT Sans Narrow',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'cyrillic',
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'PT Serif',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'cyrillic',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'PT Serif Caption',
      'variants': [
        'regular',
        'italic'
      ],
      'subsets': [
        'cyrillic',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Pacifico',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Paprika',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Parisienne',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Passero One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Passion One',
      'variants': [
        'regular',
        '700',
        '900'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Patrick Hand',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Patua One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Paytone One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Peralta',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Permanent Marker',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Petit Formal Script',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Petrona',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Philosopher',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'cyrillic',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Piedra',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Pinyon Script',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Pirata One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Plaster',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Play',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'cyrillic',
        'greek-ext',
        'latin-ext',
        'latin',
        'greek',
        'cyrillic-ext'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Playball',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Playfair Display',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic',
        '900',
        '900italic'
      ],
      'subsets': [
        'cyrillic',
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Playfair Display SC',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic',
        '900',
        '900italic'
      ],
      'subsets': [
        'cyrillic',
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Podkova',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Poiret One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'cyrillic',
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Poller One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Poly',
      'variants': [
        'regular',
        'italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Pompiere',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Pontano Sans',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Port Lligat Sans',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Port Lligat Slab',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Prata',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Preahvihear',
      'variants': [
        'regular'
      ],
      'subsets': [
        'khmer'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Press Start 2P',
      'variants': [
        'regular'
      ],
      'subsets': [
        'cyrillic',
        'latin-ext',
        'latin',
        'greek'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Princess Sofia',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Prociono',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Prosto One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'cyrillic',
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Puritan',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Purple Purse',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Quando',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Quantico',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Quattrocento',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Quattrocento Sans',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Questrial',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Quicksand',
      'variants': [
        '300',
        'regular',
        '700'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Quintessential',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Qwigley',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Racing Sans One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Radley',
      'variants': [
        'regular',
        'italic'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Raleway',
      'variants': [
        '100',
        '200',
        '300',
        'regular',
        '500',
        '600',
        '700',
        '800',
        '900'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Raleway Dots',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Rambla',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Rammetto One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Ranchers',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Rancho',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Rationale',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Redressed',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Reenie Beanie',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Revalia',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Ribeye',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Ribeye Marrow',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Righteous',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Risque',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Rochester',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Rock Salt',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Rokkitt',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Romanesco',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Ropa Sans',
      'variants': [
        'regular',
        'italic'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Rosario',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Rosarivo',
      'variants': [
        'regular',
        'italic'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Rouge Script',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Ruda',
      'variants': [
        'regular',
        '700',
        '900'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Rufina',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Ruge Boogie',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Ruluko',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Rum Raisin',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Ruslan Display',
      'variants': [
        'regular'
      ],
      'subsets': [
        'cyrillic',
        'latin-ext',
        'latin',
        'cyrillic-ext'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Russo One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'cyrillic',
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Ruthie',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Rye',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Sacramento',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Sail',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Salsa',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Sanchez',
      'variants': [
        'regular',
        'italic'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Sancreek',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Sansita One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Sarina',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Satisfy',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Scada',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'cyrillic',
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Schoolbell',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Seaweed Script',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Sevillana',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Seymour One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'cyrillic',
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Shadows Into Light',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Shadows Into Light Two',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Shanti',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Share',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Share Tech',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Share Tech Mono',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Shojumaru',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Short Stack',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Siemreap',
      'variants': [
        'regular'
      ],
      'subsets': [
        'khmer'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Sigmar One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Signika',
      'variants': [
        '300',
        'regular',
        '600',
        '700'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Signika Negative',
      'variants': [
        '300',
        'regular',
        '600',
        '700'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Simonetta',
      'variants': [
        'regular',
        'italic',
        '900',
        '900italic'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Sirin Stencil',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Six Caps',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Skranji',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Slackey',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Smokum',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Smythe',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Sniglet',
      'variants': [
        '800'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Snippet',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Snowburst One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Sofadi One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Sofia',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Sonsie One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Sorts Mill Goudy',
      'variants': [
        'regular',
        'italic'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Source Code Pro',
      'variants': [
        '200',
        '300',
        'regular',
        '600',
        '700',
        '900'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Source Sans Pro',
      'variants': [
        '200',
        '200italic',
        '300',
        '300italic',
        'regular',
        'italic',
        '600',
        '600italic',
        '700',
        '700italic',
        '900',
        '900italic'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Special Elite',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Spicy Rice',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Spinnaker',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Spirax',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Squada One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Stalemate',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Stalinist One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'cyrillic',
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Stardos Stencil',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Stint Ultra Condensed',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Stint Ultra Expanded',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Stoke',
      'variants': [
        '300',
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Strait',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Sue Ellen Francisco',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Sunshiney',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Supermercado One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Suwannaphum',
      'variants': [
        'regular'
      ],
      'subsets': [
        'khmer'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Swanky and Moo Moo',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Syncopate',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Tangerine',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Taprom',
      'variants': [
        'regular'
      ],
      'subsets': [
        'khmer'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Telex',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Tenor Sans',
      'variants': [
        'regular'
      ],
      'subsets': [
        'cyrillic',
        'latin-ext',
        'latin',
        'cyrillic-ext'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Text Me One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'The Girl Next Door',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Tienne',
      'variants': [
        'regular',
        '700',
        '900'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Tinos',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Titan One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Titillium Web',
      'variants': [
        '200',
        '200italic',
        '300',
        '300italic',
        'regular',
        'italic',
        '600',
        '600italic',
        '700',
        '700italic',
        '900'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Trade Winds',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Trocchi',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Trochut',
      'variants': [
        'regular',
        'italic',
        '700'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Trykker',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Tulpen One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Ubuntu',
      'variants': [
        '300',
        '300italic',
        'regular',
        'italic',
        '500',
        '500italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'cyrillic',
        'greek-ext',
        'latin-ext',
        'latin',
        'greek',
        'cyrillic-ext'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Ubuntu Condensed',
      'variants': [
        'regular'
      ],
      'subsets': [
        'cyrillic',
        'greek-ext',
        'latin-ext',
        'latin',
        'greek',
        'cyrillic-ext'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Ubuntu Mono',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'cyrillic',
        'greek-ext',
        'latin-ext',
        'latin',
        'greek',
        'cyrillic-ext'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Ultra',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Uncial Antiqua',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Underdog',
      'variants': [
        'regular'
      ],
      'subsets': [
        'cyrillic',
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Unica One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'UnifrakturCook',
      'variants': [
        '700'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'UnifrakturMaguntia',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Unkempt',
      'variants': [
        'regular',
        '700'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Unlock',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Unna',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'VT323',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Vampiro One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Varela',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Varela Round',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Vast Shadow',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Vibur',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Vidaloka',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Viga',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Voces',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Volkhov',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Vollkorn',
      'variants': [
        'regular',
        'italic',
        '700',
        '700italic'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Voltaire',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Waiting for the Sunrise',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Wallpoet',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Walter Turncoat',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Warnes',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Wellfleet',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Wire One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Yanone Kaffeesatz',
      'variants': [
        '200',
        '300',
        'regular',
        '700'
      ],
      'subsets': [
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Yellowtail',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Yeseva One',
      'variants': [
        'regular'
      ],
      'subsets': [
        'cyrillic',
        'latin-ext',
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Yesteryear',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    },
    {
      'kind': 'webfonts#webfont',
      'family': 'Zeyada',
      'variants': [
        'regular'
      ],
      'subsets': [
        'latin'
      ]
    }
  ]
};

/* ==========================================================
 * bootstrap-formhelpers-languages.en_US.js
 * https://github.com/vlamanna/BootstrapFormHelpers
 * ==========================================================
 * Copyright 2012 Vincent Lamanna
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */
 
var BFHLanguagesList = {
  'om': 'Afaan Oromoo',
  'aa': 'Afaraf',
  'af': 'Afrikaans',
  'ak': 'Akan',
  'an': 'aragonés',
  'ig': 'Asụsụ Igbo',
  'gn': 'Avañe\'ẽ',
  'ae': 'avesta',
  'ay': 'aymar aru',
  'az': 'azərbaycan dili',
  'id': 'Bahasa Indonesia',
  'ms': 'bahasa Melayu',
  'bm': 'bamanankan',
  'jv': 'basa Jawa',
  'su': 'Basa Sunda',
  'bi': 'Bislama',
  'bs': 'bosanski jezik',
  'br': 'brezhoneg',
  'ca': 'català',
  'ch': 'Chamoru',
  'ny': 'chiCheŵa',
  'sn': 'chiShona',
  'co': 'corsu',
  'cy': 'Cymraeg',
  'da': 'dansk',
  'se': 'Davvisámegiella',
  'de': 'Deutsch',
  'nv': 'Diné bizaad',
  'et': 'eesti',
  'na': 'Ekakairũ Naoero',
  'en': 'English',
  'es': 'español',
  'eo': 'Esperanto',
  'eu': 'euskara',
  'ee': 'Eʋegbe',
  'to': 'faka Tonga',
  'mg': 'fiteny malagasy',
  'fr': 'français',
  'fy': 'Frysk',
  'ff': 'Fulfulde',
  'fo': 'føroyskt',
  'ga': 'Gaeilge',
  'gv': 'Gaelg',
  'sm': 'gagana fa\'a Samoa',
  'gl': 'galego',
  'sq': 'gjuha shqipe',
  'gd': 'Gàidhlig',
  'ki': 'Gĩkũyũ',
  'ha': 'Hausa',
  'ho': 'Hiri Motu',
  'hr': 'hrvatski jezik',
  'io': 'Ido',
  'rw': 'Ikinyarwanda',
  'rn': 'Ikirundi',
  'ia': 'Interlingua',
  'nd': 'isiNdebele',
  'nr': 'isiNdebele',
  'xh': 'isiXhosa',
  'zu': 'isiZulu',
  'it': 'italiano',
  'ik': 'Iñupiaq',
  'pl': 'polski',
  'mh': 'Kajin M̧ajeļ',
  'kl': 'kalaallisut',
  'kr': 'Kanuri',
  'kw': 'Kernewek',
  'kg': 'KiKongo',
  'sw': 'Kiswahili',
  'ht': 'Kreyòl ayisyen',
  'kj': 'Kuanyama',
  'ku': 'Kurdî',
  'la': 'latine',
  'lv': 'latviešu valoda',
  'lt': 'lietuvių kalba',
  'ro': 'limba română',
  'li': 'Limburgs',
  'ln': 'Lingála',
  'lg': 'Luganda',
  'lb': 'Lëtzebuergesch',
  'hu': 'magyar',
  'mt': 'Malti',
  'nl': 'Nederlands',
  'no': 'Norsk',
  'nb': 'Norsk bokmål',
  'nn': 'Norsk nynorsk',
  'uz': 'O\'zbek',
  'oc': 'occitan',
  'ie': 'Interlingue',
  'hz': 'Otjiherero',
  'ng': 'Owambo',
  'pt': 'português',
  'ty': 'Reo Tahiti',
  'rm': 'rumantsch grischun',
  'qu': 'Runa Simi',
  'sc': 'sardu',
  'za': 'Saɯ cueŋƅ',
  'st': 'Sesotho',
  'tn': 'Setswana',
  'ss': 'SiSwati',
  'sl': 'slovenski jezik',
  'sk': 'slovenčina',
  'so': 'Soomaaliga',
  'fi': 'suomi',
  'sv': 'Svenska',
  'mi': 'te reo Māori',
  'vi': 'Tiếng Việt',
  'lu': 'Tshiluba',
  've': 'Tshivenḓa',
  'tw': 'Twi',
  'tk': 'Türkmen',
  'tr': 'Türkçe',
  'ug': 'Uyƣurqə',
  'vo': 'Volapük',
  'fj': 'vosa Vakaviti',
  'wa': 'walon',
  'tl': 'Wikang Tagalog',
  'wo': 'Wollof',
  'ts': 'Xitsonga',
  'yo': 'Yorùbá',
  'sg': 'yângâ tî sängö',
  'is': 'Íslenska',
  'cs': 'čeština',
  'el': 'ελληνικά',
  'av': 'авар мацӀ',
  'ab': 'аҧсуа бызшәа',
  'ba': 'башҡорт теле',
  'be': 'беларуская мова',
  'bg': 'български език',
  'os': 'ирон æвзаг',
  'kv': 'коми кыв',
  'ky': 'Кыргызча',
  'mk': 'македонски јазик',
  'mn': 'монгол',
  'ce': 'нохчийн мотт',
  'ru': 'Русский язык',
  'sr': 'српски језик',
  'tt': 'татар теле',
  'tg': 'тоҷикӣ',
  'uk': 'українська мова',
  'cv': 'чӑваш чӗлхи',
  'cu': 'ѩзыкъ словѣньскъ',
  'kk': 'қазақ тілі',
  'hy': 'Հայերեն',
  'yi': 'ייִדיש',
  'he': 'עברית',
  'ur': 'اردو',
  'ar': 'العربية',
  'fa': 'فارسی',
  'ps': 'پښتو',
  'ks': 'कश्मीरी',
  'ne': 'नेपाली',
  'pi': 'पाऴि',
  'bh': 'भोजपुरी',
  'mr': 'मराठी',
  'sa': 'संस्कृतम्',
  'sd': 'सिन्धी',
  'hi': 'हिन्दी',
  'as': 'অসমীয়া',
  'bn': 'বাংলা',
  'pa': 'ਪੰਜਾਬੀ',
  'gu': 'ગુજરાતી',
  'or': 'ଓଡ଼ିଆ',
  'ta': 'தமிழ்',
  'te': 'తెలుగు',
  'kn': 'ಕನ್ನಡ',
  'ml': 'മലയാളം',
  'si': 'සිංහල',
  'th': 'ไทย',
  'lo': 'ພາສາລາວ',
  'bo': 'བོད་ཡིག',
  'dz': 'རྫོང་ཁ',
  'my': 'ဗမာစာ',
  'ka': 'ქართული',
  'ti': 'ትግርኛ',
  'am': 'አማርኛ',
  'iu': 'ᐃᓄᒃᑎᑐᑦ',
  'oj': 'ᐊᓂᔑᓈᐯᒧᐎᓐ',
  'cr': 'ᓀᐦᐃᔭᐍᐏᐣ',
  'km': 'ខ្មែរ',
  'zh': '中文 (Zhōngwén)',
  'ja': '日本語 (にほんご)',
  'ii': 'ꆈꌠ꒿ Nuosuhxop',
  'ko': '한국어 (韓國語)'
};

/* ==========================================================
 * bootstrap-formhelpers-phone.en_US.js
 * https://github.com/vlamanna/BootstrapFormHelpers
 * ==========================================================
 * Copyright 2012 Vincent Lamanna
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file edcept in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either edpress or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */
 
var BFHPhoneFormatList = {
  'AF': '+93 0dd ddd dddd',
  'AL': '+355 0dd ddd ddd',
  'DZ': '+213 0ddd dd dd dd',
  'AS': '+1 (ddd) ddd-dddd',
  'AD': '+376 ddddddddd',
  'AO': '+244 ddd ddd ddd',
  'AI': '+1 (ddd) ddd-dddd',
  'AQ': '+672 ddddddddd',
  'AG': '+1 (ddd) ddd-dddd',
  'AR': '+54 ddddddddd',
  'AM': '+374 0dd dddddd',
  'AW': '+297 ddd dddd',
  'AU': '+61 ddd ddd ddd',
  'AT': '+43 0dddd ddddddddd',
  'AZ': '+994 ddddddddd',
  'BH': '+973 ddddddddd',
  'BD': '+880 ddddddddd',
  'BB': '+1 ddddddddd',
  'BY': '+375 ddddddddd',
  'BE': '+32 ddddddddd',
  'BZ': '+501 ddddddddd',
  'BJ': '+229 ddddddddd',
  'BM': '+1 (ddd) ddd-dddd',
  'BT': '+975 ddddddddd',
  'BO': '+591 ddddddddd',
  'BA': '+387 ddddddddd',
  'BW': '+267 ddddddddd',
  'BV': '+0 ddddddddd',
  'BR': '+55 ddddddddd',
  'IO': '+0 ddddddddd',
  'VG': '+1 (ddd) ddd-dddd',
  'BN': '+673 ddddddddd',
  'BG': '+359 ddddddddd',
  'BF': '+226 ddddddddd',
  'BI': '+257 ddddddddd',
  'CI': '+225 ddddddddd',
  'KH': '+855 ddddddddd',
  'CM': '+237 ddddddddd',
  'CA': '+1 (ddd) ddd-dddd',
  'CV': '+238 ddddddddd',
  'KY': '+1 (ddd) ddd-dddd',
  'CF': '+236 ddddddddd',
  'TD': '+235 ddddddddd',
  'CL': '+56 ddddddddd',
  'CN': '+86 ddddddddd',
  'CX': '+61 ddddddddd',
  'CC': '+61 ddddddddd',
  'CO': '+57 ddddddddd',
  'KM': '+269 ddddddddd',
  'CG': '+242 ddddddddd',
  'CK': '+682 ddddddddd',
  'CR': '+506 ddddddddd',
  'HR': '+385 ddddddddd',
  'CU': '+53 ddddddddd',
  'CY': '+357 ddddddddd',
  'CZ': '+420 ddddddddd',
  'CD': '+243 ddddddddd',
  'DK': '+45 ddddddddd',
  'DJ': '+253 ddddddddd',
  'DM': '+1 (ddd) ddd-dddd',
  'DO': '+1 (ddd) ddd-dddd',
  'TL': '+670 ddddddddd',
  'EC': '+593 ddddddddd',
  'EG': '+20 ddddddddd',
  'SV': '+503 ddddddddd',
  'GQ': '+240 ddddddddd',
  'ER': '+291 ddddddddd',
  'EE': '+372 ddddddddd',
  'ET': '+251 ddddddddd',
  'FO': '+298 ddddddddd',
  'FK': '+500 ddddddddd',
  'FJ': '+679 ddddddddd',
  'FI': '+358 ddddddddd',
  'MK': '+389 ddddddddd',
  'FR': '+33 d dd dd dd dd',
  'GF': '+594 ddddddddd',
  'PF': '+689 ddddddddd',
  'TF': '+262 ddddddddd',
  'GA': '+241 ddddddddd',
  'GE': '+995 ddddddddd',
  'DE': '+49 ddddddddd',
  'GH': '+233 ddddddddd',
  'GI': '+350 ddddddddd',
  'GR': '+30 ddddddddd',
  'GL': '+299 ddddddddd',
  'GD': '+1 (ddd) ddd-dddd',
  'GP': '+590 ddddddddd',
  'GU': '+1 (ddd) ddd-dddd',
  'GT': '+502 ddddddddd',
  'GN': '+224 ddddddddd',
  'GW': '+245 ddddddddd',
  'GY': '+592 ddddddddd',
  'HT': '+509 ddddddddd',
  'HM': '+0 ddddddddd',
  'HN': '+504 ddddddddd',
  'HK': '+852 ddddddddd',
  'HU': '+36 ddddddddd',
  'IS': '+354 ddddddddd',
  'IN': '+91 ddddddddd',
  'ID': '+62 ddddddddd',
  'IR': '+98 ddddddddd',
  'IQ': '+964 ddddddddd',
  'IE': '+353 ddddddddd',
  'IL': '+972 ddddddddd',
  'IT': '+39 ddddddddd',
  'JM': '+1 (ddd) ddd-dddd',
  'JP': '+81 ddddddddd',
  'JO': '+962 ddddddddd',
  'KZ': '+7 ddddddddd',
  'KE': '+254 ddddddddd',
  'KI': '+686 ddddddddd',
  'KW': '+965 ddddddddd',
  'KG': '+996 ddddddddd',
  'LA': '+856 ddddddddd',
  'LV': '+371 ddddddddd',
  'LB': '+961 ddddddddd',
  'LS': '+266 ddddddddd',
  'LR': '+231 ddddddddd',
  'LY': '+218 ddddddddd',
  'LI': '+423 ddddddddd',
  'LT': '+370 ddddddddd',
  'LU': '+352 ddddddddd',
  'MO': '+853 ddddddddd',
  'MG': '+261 ddddddddd',
  'MW': '+265 ddddddddd',
  'MY': '+60 ddddddddd',
  'MV': '+960 ddddddddd',
  'ML': '+223 ddddddddd',
  'MT': '+356 ddddddddd',
  'MH': '+692 ddddddddd',
  'MQ': '+596 ddddddddd',
  'MR': '+222 ddddddddd',
  'MU': '+230 ddddddddd',
  'YT': '+262 ddddddddd',
  'MX': '+52 ddddddddd',
  'FM': '+691 ddddddddd',
  'MD': '+373 ddddddddd',
  'MC': '+377 ddddddddd',
  'MN': '+976 ddddddddd',
  'MS': '+1 (ddd) ddd-dddd',
  'MA': '+212 ddddddddd',
  'MZ': '+258 ddddddddd',
  'MM': '+95 ddddddddd',
  'NA': '+264 ddddddddd',
  'NR': '+674 ddddddddd',
  'NP': '+977 ddddddddd',
  'NL': '+31 ddddddddd',
  'AN': '+599 ddddddddd',
  'NC': '+687 ddddddddd',
  'NZ': '+64 ddddddddd',
  'NI': '+505 ddddddddd',
  'NE': '+227 ddddddddd',
  'NG': '+234 ddddddddd',
  'NU': '+683 ddddddddd',
  'NF': '+672 ddddddddd',
  'KP': '+850 ddddddddd',
  'MP': '+1 (ddd) ddd-dddd',
  'NO': '+47 ddddddddd',
  'OM': '+968 ddddddddd',
  'PK': '+92 ddddddddd',
  'PW': '+680 ddddddddd',
  'PA': '+507 ddddddddd',
  'PG': '+675 ddddddddd',
  'PY': '+595 ddddddddd',
  'PE': '+51 ddddddddd',
  'PH': '+63 ddddddddd',
  'PN': '+870 ddddddddd',
  'PL': '+48 ddddddddd',
  'PT': '+351 ddddddddd',
  'PR': '+1 (ddd) ddd-dddd',
  'QA': '+974 ddddddddd',
  'RE': '+262 ddddddddd',
  'RO': '+40 ddddddddd',
  'RU': '+7 ddddddddd',
  'RW': '+250 ddddddddd',
  'ST': '+239 ddddddddd',
  'SH': '+290 ddddddddd',
  'KN': '+1 (ddd) ddd-dddd',
  'LC': '+1 (ddd) ddd-dddd',
  'PM': '+508 ddddddddd',
  'VC': '+1 (ddd) ddd-dddd',
  'WS': '+685 ddddddddd',
  'SM': '+378 ddddddddd',
  'SA': '+966 ddddddddd',
  'SN': '+221 ddddddddd',
  'SC': '+248 ddddddddd',
  'SL': '+232 ddddddddd',
  'SG': '+65 ddddddddd',
  'SK': '+421 ddddddddd',
  'SI': '+386 ddddddddd',
  'SB': '+677 ddddddddd',
  'SO': '+252 ddddddddd',
  'ZA': '+27 ddddddddd',
  'GS': '+0 ddddddddd',
  'KR': '+82 ddddddddd',
  'ES': '+34 ddddddddd',
  'LK': '+94 ddddddddd',
  'SD': '+249 ddddddddd',
  'SR': '+597 ddddddddd',
  'SJ': '+0 ddddddddd',
  'SZ': '+268 ddddddddd',
  'SE': '+46 ddddddddd',
  'CH': '+41 ddddddddd',
  'SY': '+963 ddddddddd',
  'TW': '+886 ddddddddd',
  'TJ': '+992 ddddddddd',
  'TZ': '+255 ddddddddd',
  'TH': '+66 ddddddddd',
  'BS': '+1 (ddd) ddd-dddd',
  'GM': '+220 ddddddddd',
  'TG': '+228 ddddddddd',
  'TK': '+690 ddddddddd',
  'TO': '+676 ddddddddd',
  'TT': '+1 (ddd) ddd-dddd',
  'TN': '+216 ddddddddd',
  'TR': '+90 ddddddddd',
  'TM': '+993 ddddddddd',
  'TC': '+1 (ddd) ddd-dddd',
  'TV': '+688 ddddddddd',
  'VI': '+1 (ddd) ddd-dddd',
  'UG': '+256 ddddddddd',
  'UA': '+380 ddddddddd',
  'AE': '+971 ddddddddd',
  'GB': '+44 (ddd) dddd dddd',
  'US': '+1 (ddd) ddd-dddd',
  'UM': '+0 ddddddddd',
  'UY': '+598 ddddddddd',
  'UZ': '+998 ddddddddd',
  'VU': '+678 ddddddddd',
  'VA': '+39 ddddddddd',
  'VE': '+58 ddddddddd',
  'VN': '+84 ddddddddd',
  'WF': '+681 ddddddddd',
  'EH': '+0 ddddddddd',
  'YE': '+967 ddddddddd',
  'YU': '+0 ddddddddd',
  'ZM': '+260 ddddddddd',
  'ZW': '+263 ddddddddd'
};

/* ==========================================================
 * bootstrap-formhelpers-states.en_US.js
 * https://github.com/vlamanna/BootstrapFormHelpers
 * ==========================================================
 * Copyright 2012 Vincent Lamanna
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */

var BFHStatesList = {
  'AF':{
    '1' : {'code':'BAL','name':'Balkh'},
    '2' : {'code':'BAM','name':'Bamian'},
    '3' : {'code':'BDG','name':'Badghis'},
    '4' : {'code':'BDS','name':'Badakhshan'},
    '5' : {'code':'BGL','name':'Baghlan'},
    '6' : {'code':'FRA','name':'Farah'},
    '7' : {'code':'FYB','name':'Faryab'},
    '8' : {'code':'GHA','name':'Ghazni'},
    '9' : {'code':'GHO','name':'Ghowr'},
    '10' : {'code':'HEL','name':'Helmand'},
    '11' : {'code':'HER','name':'Herat'},
    '12' : {'code':'JOW','name':'Jowzjan'},
    '13' : {'code':'KAB','name':'Kabul'},
    '14' : {'code':'KAN','name':'Kandahar'},
    '15' : {'code':'KAP','name':'Kapisa'},
    '16' : {'code':'KDZ','name':'Kondoz'},
    '17' : {'code':'KHO','name':'Khost'},
    '18' : {'code':'KNR','name':'Konar'},
    '19' : {'code':'LAG','name':'Laghman'},
    '20' : {'code':'LOW','name':'Lowgar'},
    '21' : {'code':'NAN','name':'Nangrahar'},
    '22' : {'code':'NIM','name':'Nimruz'},
    '23' : {'code':'NUR','name':'Nurestan'},
    '24' : {'code':'ORU','name':'Oruzgan'},
    '25' : {'code':'PAR','name':'Parwan'},
    '26' : {'code':'PIA','name':'Paktia'},
    '27' : {'code':'PKA','name':'Paktika'},
    '28' : {'code':'SAM','name':'Samangan'},
    '29' : {'code':'SAR','name':'Sar-e Pol'},
    '30' : {'code':'TAK','name':'Takhar'},
    '31' : {'code':'WAR','name':'Wardak'},
    '32' : {'code':'ZAB','name':'Zabol'}
  },
  'AL':{
    '1' : {'code':'BR','name':'Berat'},
    '2' : {'code':'BU','name':'Bulqize'},
    '3' : {'code':'DI','name':'Diber'},
    '4' : {'code':'DL','name':'Delvine'},
    '5' : {'code':'DR','name':'Durres'},
    '6' : {'code':'DV','name':'Devoll'},
    '7' : {'code':'EL','name':'Elbasan'},
    '8' : {'code':'ER','name':'Kolonje'},
    '9' : {'code':'FR','name':'Fier'},
    '10' : {'code':'GJ','name':'Gjirokaster'},
    '11' : {'code':'GR','name':'Gramsh'},
    '12' : {'code':'HA','name':'Has'},
    '13' : {'code':'KA','name':'Kavaje'},
    '14' : {'code':'KB','name':'Kurbin'},
    '15' : {'code':'KC','name':'Kucove'},
    '16' : {'code':'KO','name':'Korce'},
    '17' : {'code':'KR','name':'Kruje'},
    '18' : {'code':'KU','name':'Kukes'},
    '19' : {'code':'LB','name':'Librazhd'},
    '20' : {'code':'LE','name':'Lezhe'},
    '21' : {'code':'LU','name':'Lushnje'},
    '22' : {'code':'MK','name':'Mallakaster'},
    '23' : {'code':'MM','name':'Malesi e Madhe'},
    '24' : {'code':'MR','name':'Mirdite'},
    '25' : {'code':'MT','name':'Mat'},
    '26' : {'code':'PG','name':'Pogradec'},
    '27' : {'code':'PQ','name':'Peqin'},
    '28' : {'code':'PR','name':'Permet'},
    '29' : {'code':'PU','name':'Puke'},
    '30' : {'code':'SH','name':'Shkoder'},
    '31' : {'code':'SK','name':'Skrapar'},
    '32' : {'code':'SR','name':'Sarande'},
    '33' : {'code':'TE','name':'Tepelene'},
    '34' : {'code':'TP','name':'Tropoje'},
    '35' : {'code':'TR','name':'Tirane'},
    '36' : {'code':'VL','name':'Vlore'}
  },
  'DZ':{
    '1' : {'code':'ADE','name':'Ain Defla'},
    '2' : {'code':'ADR','name':'Adrar'},
    '3' : {'code':'ALG','name':'Alger'},
    '4' : {'code':'ANN','name':'Annaba'},
    '5' : {'code':'ATE','name':'Ain Temouchent'},
    '6' : {'code':'BAT','name':'Batna'},
    '7' : {'code':'BBA','name':'Bordj Bou Arreridj'},
    '8' : {'code':'BEC','name':'Bechar'},
    '9' : {'code':'BEJ','name':'Bejaia'},
    '10' : {'code':'BIS','name':'Biskra'},
    '11' : {'code':'BLI','name':'Blida'},
    '12' : {'code':'BMD','name':'Boumerdes'},
    '13' : {'code':'BOA','name':'Bouira'},
    '14' : {'code':'CHL','name':'Chlef'},
    '15' : {'code':'CON','name':'Constantine'},
    '16' : {'code':'DJE','name':'Djelfa'},
    '17' : {'code':'EBA','name':'El Bayadh'},
    '18' : {'code':'EOU','name':'El Oued'},
    '19' : {'code':'ETA','name':'El Tarf'},
    '20' : {'code':'GHA','name':'Ghardaia'},
    '21' : {'code':'GUE','name':'Guelma'},
    '22' : {'code':'ILL','name':'Illizi'},
    '23' : {'code':'JIJ','name':'Jijel'},
    '24' : {'code':'KHE','name':'Khenchela'},
    '25' : {'code':'LAG','name':'Laghouat'},
    '26' : {'code':'MED','name':'Medea'},
    '27' : {'code':'MIL','name':'Mila'},
    '28' : {'code':'MOS','name':'Mostaganem'},
    '29' : {'code':'MSI','name':'M\'Sila'},
    '30' : {'code':'MUA','name':'Muaskar'},
    '31' : {'code':'NAA','name':'Naama'},
    '32' : {'code':'OEB','name':'Oum el-Bouaghi'},
    '33' : {'code':'ORA','name':'Oran'},
    '34' : {'code':'OUA','name':'Ouargla'},
    '35' : {'code':'REL','name':'Relizane'},
    '36' : {'code':'SAH','name':'Souk Ahras'},
    '37' : {'code':'SAI','name':'Saida'},
    '38' : {'code':'SBA','name':'Sidi Bel Abbes'},
    '39' : {'code':'SET','name':'Setif'},
    '40' : {'code':'SKI','name':'Skikda'},
    '41' : {'code':'TAM','name':'Tamanghasset'},
    '42' : {'code':'TEB','name':'Tebessa'},
    '43' : {'code':'TIA','name':'Tiaret'},
    '44' : {'code':'TIN','name':'Tindouf'},
    '45' : {'code':'TIP','name':'Tipaza'},
    '46' : {'code':'TIS','name':'Tissemsilt'},
    '47' : {'code':'TLE','name':'Tlemcen'},
    '48' : {'code':'TOU','name':'Tizi Ouzou'}
  },
  'AS':{
    '1' : {'code':'E','name':'Eastern'},
    '2' : {'code':'M','name':'Manu\'a'},
    '3' : {'code':'R','name':'Rose Island'},
    '4' : {'code':'S','name':'Swains Island'},
    '5' : {'code':'W','name':'Western'}
  },
  'AD':{
    '1' : {'code':'ALV','name':'Andorra la Vella'},
    '2' : {'code':'CAN','name':'Canillo'},
    '3' : {'code':'ENC','name':'Encamp'},
    '4' : {'code':'ESE','name':'Escaldes-Engordany'},
    '5' : {'code':'LMA','name':'La Massana'},
    '6' : {'code':'ORD','name':'Ordino'},
    '7' : {'code':'SJL','name':'Sant Julià de Lòria'}
  },
  'AO':{
    '1' : {'code':'BGO','name':'Bengo'},
    '2' : {'code':'BGU','name':'Benguela'},
    '3' : {'code':'BIE','name':'Bie'},
    '4' : {'code':'CAB','name':'Cabinda'},
    '5' : {'code':'CCU','name':'Cuando-Cubango'},
    '6' : {'code':'CNO','name':'Cuanza Norte'},
    '7' : {'code':'CUS','name':'Cuanza Sul'},
    '8' : {'code':'CNN','name':'Cunene'},
    '9' : {'code':'HUA','name':'Huambo'},
    '10' : {'code':'HUI','name':'Huila'},
    '11' : {'code':'LUA','name':'Luanda'},
    '12' : {'code':'LNO','name':'Lunda Norte'},
    '13' : {'code':'LSU','name':'Lunda Sul'},
    '14' : {'code':'MAL','name':'Malange'},
    '15' : {'code':'MOX','name':'Moxico'},
    '16' : {'code':'NAM','name':'Namibe'},
    '17' : {'code':'UIG','name':'Uige'},
    '18' : {'code':'ZAI','name':'Zaire'}
  },
  'AI':{
    '1' : {'code':'ANG','name':'Anguillita'},
    '2' : {'code':'ANG','name':'Anguila'},
    '3' : {'code':'DOG','name':'Dog'},
    '4' : {'code':'LIT','name':'Little Scrub'},
    '5' : {'code':'PRI','name':'Prickly Pear'},
    '6' : {'code':'SAN','name':'Sandy'},
    '7' : {'code':'SCR','name':'Scrub'},
    '8' : {'code':'SEA','name':'Seal'},
    '9' : {'code':'SOM','name':'Sombrero'}
  },
  'AQ':{
    '1' : {'code':'ASG','name':'Saint George'},
    '2' : {'code':'ASH','name':'Saint Philip'},
    '3' : {'code':'ASJ','name':'Saint John'},
    '4' : {'code':'ASL','name':'Saint Paul'},
    '5' : {'code':'ASM','name':'Saint Mary'},
    '6' : {'code':'ASR','name':'Saint Peter'},
    '7' : {'code':'BAR','name':'Barbuda'},
    '8' : {'code':'RED','name':'Redonda'}
  },
  'AR':{
    '1' : {'code':'AN','name':'Antartida e Islas del Atlantico'},
    '2' : {'code':'BA','name':'Buenos Aires'},
    '3' : {'code':'CA','name':'Catamarca'},
    '4' : {'code':'CH','name':'Chaco'},
    '5' : {'code':'CU','name':'Chubut'},
    '6' : {'code':'CO','name':'Cordoba'},
    '7' : {'code':'CR','name':'Corrientes'},
    '8' : {'code':'CF','name':'Capital Federal'},
    '9' : {'code':'ER','name':'Entre Rios'},
    '10' : {'code':'FO','name':'Formosa'},
    '11' : {'code':'JU','name':'Jujuy'},
    '12' : {'code':'LP','name':'La Pampa'},
    '13' : {'code':'LR','name':'La Rioja'},
    '14' : {'code':'ME','name':'Mendoza'},
    '15' : {'code':'MI','name':'Misiones'},
    '16' : {'code':'NE','name':'Neuquen'},
    '17' : {'code':'RN','name':'Rio Negro'},
    '18' : {'code':'SA','name':'Salta'},
    '19' : {'code':'SJ','name':'San Juan'},
    '20' : {'code':'SL','name':'San Luis'},
    '21' : {'code':'SC','name':'Santa Cruz'},
    '22' : {'code':'SF','name':'Santa Fe'},
    '23' : {'code':'SD','name':'Santiago del Estero'},
    '24' : {'code':'TF','name':'Tierra del Fuego'},
    '25' : {'code':'TU','name':'Tucuman'}
  },
  'AM':{
    '1' : {'code':'AGT','name':'Aragatsotn'},
    '2' : {'code':'ARR','name':'Ararat'},
    '3' : {'code':'ARM','name':'Armavir'},
    '4' : {'code':'GEG','name':'Geghark \'unik\''},
    '5' : {'code':'KOT','name':'Kotayk\''},
    '6' : {'code':'LOR','name':'Lorri'},
    '7' : {'code':'SHI','name':'Shirak'},
    '8' : {'code':'SYU','name':'Syunik\''},
    '9' : {'code':'TAV','name':'Tavush'},
    '10' : {'code':'VAY','name':'Vayots\' Dzor'},
    '11' : {'code':'YER','name':'Yerevan'}
  },
  'AW':{
    '1' : {'code':'ARU','name':'Aruba'},
    '2' : {'code':'DRU','name':'Druif Beach'},
    '3' : {'code':'MAN','name':'Manchebo Beach'},
    '4' : {'code':'NOO','name':'Noord'},
    '5' : {'code':'ORA','name':'Oranjestad'},
    '6' : {'code':'PAL','name':'Palm Beach'},
    '7' : {'code':'ROO','name':'Rooi Thomas'},
    '8' : {'code':'SIN','name':'Sint Nicolaas'},
    '9' : {'code':'SIN','name':'Sint Nicolas'},
    '10' : {'code':'WAY','name':'Wayaca'}
  },
  'AU':{
    '1' : {'code':'ACT','name':'Australian Capital Territory'},
    '2' : {'code':'NSW','name':'New South Wales'},
    '3' : {'code':'NT','name':'Northern Territory'},
    '4' : {'code':'QLD','name':'Queensland'},
    '5' : {'code':'SA','name':'South Australia'},
    '6' : {'code':'TAS','name':'Tasmania'},
    '7' : {'code':'VIC','name':'Victoria'},
    '8' : {'code':'WA','name':'Western Australia'}
  },
  'AT':{
    '1' : {'code':'BUR','name':'Burgenland'},
    '2' : {'code':'KAR','name':'Krnten'},
    '3' : {'code':'NOS','name':'Niederöesterreich'},
    '4' : {'code':'OOS','name':'Oberöesterreich'},
    '5' : {'code':'SAL','name':'Salzburg'},
    '6' : {'code':'STE','name':'Steiermark'},
    '7' : {'code':'TIR','name':'Tirol'},
    '8' : {'code':'VOR','name':'Vorarlberg'},
    '9' : {'code':'WIE','name':'Wien'}
  },
  'AZ':{
    '1' : {'code':'AB','name':'Ali Bayramli'},
    '2' : {'code':'ABS','name':'Abseron'},
    '3' : {'code':'AGC','name':'AgcabAdi'},
    '4' : {'code':'AGM','name':'Agdam'},
    '5' : {'code':'AGS','name':'Agdas'},
    '6' : {'code':'AGA','name':'Agstafa'},
    '7' : {'code':'AGU','name':'Agsu'},
    '8' : {'code':'AST','name':'Astara'},
    '9' : {'code':'BA','name':'Baki'},
    '10' : {'code':'BAB','name':'BabAk'},
    '11' : {'code':'BAL','name':'BalakAn'},
    '12' : {'code':'BAR','name':'BArdA'},
    '13' : {'code':'BEY','name':'Beylaqan'},
    '14' : {'code':'BIL','name':'Bilasuvar'},
    '15' : {'code':'CAB','name':'Cabrayil'},
    '16' : {'code':'CAL','name':'Calilabab'},
    '17' : {'code':'CUL','name':'Culfa'},
    '18' : {'code':'DAS','name':'Daskasan'},
    '19' : {'code':'DAV','name':'Davaci'},
    '20' : {'code':'FUZ','name':'Fuzuli'},
    '21' : {'code':'GA','name':'Ganca'},
    '22' : {'code':'GAD','name':'Gadabay'},
    '23' : {'code':'GOR','name':'Goranboy'},
    '24' : {'code':'GOY','name':'Goycay'},
    '25' : {'code':'HAC','name':'Haciqabul'},
    '26' : {'code':'IMI','name':'Imisli'},
    '27' : {'code':'ISM','name':'Ismayilli'},
    '28' : {'code':'KAL','name':'Kalbacar'},
    '29' : {'code':'KUR','name':'Kurdamir'},
    '30' : {'code':'LA','name':'Lankaran'},
    '31' : {'code':'LAC','name':'Lacin'},
    '32' : {'code':'LAN','name':'Lankaran'},
    '33' : {'code':'LER','name':'Lerik'},
    '34' : {'code':'MAS','name':'Masalli'},
    '35' : {'code':'MI','name':'Mingacevir'},
    '36' : {'code':'NA','name':'Naftalan'},
    '37' : {'code':'NX','name':'Naxcivan'},
    '38' : {'code':'NEF','name':'Neftcala'},
    '39' : {'code':'OGU','name':'Oguz'},
    '40' : {'code':'ORD','name':'Ordubad'},
    '41' : {'code':'QAB','name':'Qabala'},
    '42' : {'code':'QAX','name':'Qax'},
    '43' : {'code':'QAZ','name':'Qazax'},
    '44' : {'code':'QOB','name':'Qobustan'},
    '45' : {'code':'QBA','name':'Quba'},
    '46' : {'code':'QBI','name':'Qubadli'},
    '47' : {'code':'QUS','name':'Qusar'},
    '48' : {'code':'SA','name':'Saki'},
    '49' : {'code':'SAT','name':'Saatli'},
    '50' : {'code':'SAB','name':'Sabirabad'},
    '51' : {'code':'SAD','name':'Sadarak'},
    '52' : {'code':'SAH','name':'Sahbuz'},
    '53' : {'code':'SAK','name':'Saki'},
    '54' : {'code':'SAL','name':'Salyan'},
    '55' : {'code':'SM','name':'Sumqayit'},
    '56' : {'code':'SMI','name':'Samaxi'},
    '57' : {'code':'SKR','name':'Samkir'},
    '58' : {'code':'SMX','name':'Samux'},
    '59' : {'code':'SAR','name':'Sarur'},
    '60' : {'code':'SIY','name':'Siyazan'},
    '61' : {'code':'SS','name':'Susa'},
    '62' : {'code':'SUS','name':'Susa'},
    '63' : {'code':'TAR','name':'Tartar'},
    '64' : {'code':'TOV','name':'Tovuz'},
    '65' : {'code':'UCA','name':'Ucar'},
    '66' : {'code':'XA','name':'Xankandi'},
    '67' : {'code':'XAC','name':'Xacmaz'},
    '68' : {'code':'XAN','name':'Xanlar'},
    '69' : {'code':'XIZ','name':'Xizi'},
    '70' : {'code':'XCI','name':'Xocali'},
    '71' : {'code':'XVD','name':'Xocavand'},
    '72' : {'code':'YAR','name':'Yardimli'},
    '73' : {'code':'YEV','name':'Yevlax'},
    '74' : {'code':'ZAN','name':'Zangilan'},
    '75' : {'code':'ZAQ','name':'Zaqatala'},
    '76' : {'code':'ZAR','name':'Zardab'}
  },
  'BS':{
    '1' : {'code':'ACK','name':'Acklins'},
    '2' : {'code':'BER','name':'Berry Islands'},
    '3' : {'code':'BIM','name':'Bimini'},
    '4' : {'code':'BLK','name':'Black Point'},
    '5' : {'code':'CAT','name':'Cat Island'},
    '6' : {'code':'CAB','name':'Central Abaco'},
    '7' : {'code':'CAN','name':'Central Andros'},
    '8' : {'code':'CEL','name':'Central Eleuthera'},
    '9' : {'code':'FRE','name':'City of Freeport'},
    '10' : {'code':'CRO','name':'Crooked Island'},
    '11' : {'code':'EGB','name':'East Grand Bahama'},
    '12' : {'code':'EXU','name':'Exuma'},
    '13' : {'code':'GRD','name':'Grand Cay'},
    '14' : {'code':'HAR','name':'Harbour Island'},
    '15' : {'code':'HOP','name':'Hope Town'},
    '16' : {'code':'INA','name':'Inagua'},
    '17' : {'code':'LNG','name':'Long Island'},
    '18' : {'code':'MAN','name':'Mangrove Cay'},
    '19' : {'code':'MAY','name':'Mayaguana'},
    '20' : {'code':'MOO','name':'Moore\'s Island'},
    '21' : {'code':'NAB','name':'North Abaco'},
    '22' : {'code':'NAN','name':'North Andros'},
    '23' : {'code':'NEL','name':'North Eleuthera'},
    '24' : {'code':'RAG','name':'Ragged Island'},
    '25' : {'code':'RUM','name':'Rum Cay'},
    '26' : {'code':'SAL','name':'San Salvador'},
    '27' : {'code':'SAB','name':'South Abaco'},
    '28' : {'code':'SAN','name':'South Andros'},
    '29' : {'code':'SEL','name':'South Eleuthera'},
    '30' : {'code':'SWE','name':'Spanish Wells'},
    '31' : {'code':'WGB','name':'West Grand Bahama'}
  },
  'BH':{
    '1' : {'code':'CAP','name':'Capital'},
    '2' : {'code':'CEN','name':'Central'},
    '3' : {'code':'MUH','name':'Muharraq'},
    '4' : {'code':'NOR','name':'Northern'},
    '5' : {'code':'SOU','name':'Southern'}
  },
  'BD':{
    '1' : {'code':'BAR','name':'Barisal'},
    '2' : {'code':'CHI','name':'Chittagong'},
    '3' : {'code':'DHA','name':'Dhaka'},
    '4' : {'code':'KHU','name':'Khulna'},
    '5' : {'code':'RAJ','name':'Rajshahi'},
    '6' : {'code':'SYL','name':'Sylhet'}
  },
  'BB':{
    '1' : {'code':'CC','name':'Christ Church'},
    '2' : {'code':'AND','name':'Saint Andrew'},
    '3' : {'code':'GEO','name':'Saint George'},
    '4' : {'code':'JAM','name':'Saint James'},
    '5' : {'code':'JOH','name':'Saint John'},
    '6' : {'code':'JOS','name':'Saint Joseph'},
    '7' : {'code':'LUC','name':'Saint Lucy'},
    '8' : {'code':'MIC','name':'Saint Michael'},
    '9' : {'code':'PET','name':'Saint Peter'},
    '10' : {'code':'PHI','name':'Saint Philip'},
    '11' : {'code':'THO','name':'Saint Thomas'}
  },
  'BY':{
    '1' : {'code':'BR','name':'Brestskaya (Brest)'},
    '2' : {'code':'HO','name':'Homyel\'skaya (Homyel\')'},
    '3' : {'code':'HM','name':'Horad Minsk'},
    '4' : {'code':'HR','name':'Hrodzyenskaya (Hrodna)'},
    '5' : {'code':'MA','name':'Mahilyowskaya (Mahilyow)'},
    '6' : {'code':'MI','name':'Minskaya'},
    '7' : {'code':'VI','name':'Vitsyebskaya (Vitsyebsk)'}
  },
  'BE':{
    '1' : {'code':'VAN','name':'Antwerpen'},
    '2' : {'code':'WBR','name':'Brabant Wallon'},
    '3' : {'code':'WHT','name':'Hainaut'},
    '4' : {'code':'WLG','name':'Liege'},
    '5' : {'code':'VLI','name':'Limburg'},
    '6' : {'code':'WLX','name':'Luxembourg'},
    '7' : {'code':'WNA','name':'Namur'},
    '8' : {'code':'VOV','name':'Oost-Vlaanderen'},
    '9' : {'code':'VBR','name':'Vlaams Brabant'},
    '10' : {'code':'VWV','name':'West-Vlaanderen'}
  },
  'BZ':{
    '1' : {'code':'BZ','name':'Belize'},
    '2' : {'code':'CY','name':'Cayo'},
    '3' : {'code':'CR','name':'Corozal'},
    '4' : {'code':'OW','name':'Orange Walk'},
    '5' : {'code':'SC','name':'Stann Creek'},
    '6' : {'code':'TO','name':'Toledo'}
  },
  'BJ':{
    '1' : {'code':'AL','name':'Alibori'},
    '2' : {'code':'AK','name':'Atakora'},
    '3' : {'code':'AQ','name':'Atlantique'},
    '4' : {'code':'BO','name':'Borgou'},
    '5' : {'code':'CO','name':'Collines'},
    '6' : {'code':'DO','name':'Donga'},
    '7' : {'code':'KO','name':'Kouffo'},
    '8' : {'code':'LI','name':'Littoral'},
    '9' : {'code':'MO','name':'Mono'},
    '10' : {'code':'OU','name':'Oueme'},
    '11' : {'code':'PL','name':'Plateau'},
    '12' : {'code':'ZO','name':'Zou'}
  },
  'BM':{
    '1' : {'code':'DS','name':'Devonshire'},
    '2' : {'code':'HC','name':'Hamilton City'},
    '3' : {'code':'HA','name':'Hamilton'},
    '4' : {'code':'PG','name':'Paget'},
    '5' : {'code':'PB','name':'Pembroke'},
    '6' : {'code':'GC','name':'Saint George City'},
    '7' : {'code':'SG','name':'Saint George\'s'},
    '8' : {'code':'SA','name':'Sandys'},
    '9' : {'code':'SM','name':'Smith\'s'},
    '10' : {'code':'SH','name':'Southampton'},
    '11' : {'code':'WA','name':'Warwick'}
  },
  'BT':{
    '1' : {'code':'BUM','name':'Bumthang'},
    '2' : {'code':'CHU','name':'Chukha'},
    '3' : {'code':'DAG','name':'Dagana'},
    '4' : {'code':'GAS','name':'Gasa'},
    '5' : {'code':'HAA','name':'Haa'},
    '6' : {'code':'LHU','name':'Lhuntse'},
    '7' : {'code':'MON','name':'Mongar'},
    '8' : {'code':'PAR','name':'Paro'},
    '9' : {'code':'PEM','name':'Pemagatshel'},
    '10' : {'code':'PUN','name':'Punakha'},
    '11' : {'code':'SJO','name':'Samdrup Jongkhar'},
    '12' : {'code':'SAT','name':'Samtse'},
    '13' : {'code':'SAR','name':'Sarpang'},
    '14' : {'code':'THI','name':'Thimphu'},
    '15' : {'code':'TRG','name':'Trashigang'},
    '16' : {'code':'TRY','name':'Trashiyangste'},
    '17' : {'code':'TRO','name':'Trongsa'},
    '18' : {'code':'TSI','name':'Tsirang'},
    '19' : {'code':'WPH','name':'Wangdue Phodrang'},
    '20' : {'code':'ZHE','name':'Zhemgang'}
  },
  'BO':{
    '1' : {'code':'BEN','name':'Beni'},
    '2' : {'code':'CHU','name':'Chuquisaca'},
    '3' : {'code':'COC','name':'Cochabamba'},
    '4' : {'code':'LPZ','name':'La Paz'},
    '5' : {'code':'ORU','name':'Oruro'},
    '6' : {'code':'PAN','name':'Pando'},
    '7' : {'code':'POT','name':'Potosi'},
    '8' : {'code':'SCZ','name':'Santa Cruz'},
    '9' : {'code':'TAR','name':'Tarija'}
  },
  'BA':{
    '1' : {'code':'BRO','name':'Brcko district'},
    '2' : {'code':'FBP','name':'Bosanskopodrinjski Kanton'},
    '3' : {'code':'FHN','name':'Hercegovacko-neretvanski Kanton'},
    '4' : {'code':'FPO','name':'Posavski Kanton'},
    '5' : {'code':'FSA','name':'Kanton Sarajevo'},
    '6' : {'code':'FSB','name':'Srednjebosanski Kanton'},
    '7' : {'code':'FTU','name':'Tuzlanski Kanton'},
    '8' : {'code':'FUS','name':'Unsko-Sanski Kanton'},
    '9' : {'code':'FZA','name':'Zapadnobosanska'},
    '10' : {'code':'FZE','name':'Zenicko-Dobojski Kanton'},
    '11' : {'code':'FZH','name':'Zapadnohercegovacka Zupanija'},
    '12' : {'code':'SBI','name':'Bijeljina'},
    '13' : {'code':'SBL','name':'Banja Luka'},
    '14' : {'code':'SDO','name':'Doboj'},
    '15' : {'code':'SFO','name':'Foca'},
    '16' : {'code':'SSR','name':'Sarajevo-Romanija or Sokolac'},
    '17' : {'code':'STR','name':'Trebinje'},
    '18' : {'code':'SVL','name':'Vlasenica'}
  },
  'BW':{
    '1' : {'code':'CE','name':'Central'},
    '2' : {'code':'GH','name':'Ghanzi'},
    '3' : {'code':'KD','name':'Kgalagadi'},
    '4' : {'code':'KT','name':'Kgatleng'},
    '5' : {'code':'KW','name':'Kweneng'},
    '6' : {'code':'NG','name':'Ngamiland'},
    '7' : {'code':'NE','name':'North East'},
    '8' : {'code':'NW','name':'North West'},
    '9' : {'code':'SE','name':'South East'},
    '10' : {'code':'SO','name':'Southern'}
  },
  'BR':{
    '1' : {'code':'AC','name':'Acre'},
    '2' : {'code':'AL','name':'Alagoas'},
    '3' : {'code':'AP','name':'Amapa'},
    '4' : {'code':'AM','name':'Amazonas'},
    '5' : {'code':'BA','name':'Bahia'},
    '6' : {'code':'CE','name':'Ceara'},
    '7' : {'code':'DF','name':'Distrito Federal'},
    '8' : {'code':'ES','name':'Espirito Santo'},
    '9' : {'code':'GO','name':'Goias'},
    '10' : {'code':'MA','name':'Maranhao'},
    '11' : {'code':'MT','name':'Mato Grosso'},
    '12' : {'code':'MS','name':'Mato Grosso do Sul'},
    '13' : {'code':'MG','name':'Minas Gerais'},
    '14' : {'code':'PA','name':'Para'},
    '15' : {'code':'PB','name':'Paraiba'},
    '16' : {'code':'PR','name':'Parana'},
    '17' : {'code':'PE','name':'Pernambuco'},
    '18' : {'code':'PI','name':'Piaui'},
    '19' : {'code':'RJ','name':'Rio de Janeiro'},
    '20' : {'code':'RN','name':'Rio Grande do Norte'},
    '21' : {'code':'RS','name':'Rio Grande do Sul'},
    '22' : {'code':'RO','name':'Rondonia'},
    '23' : {'code':'RR','name':'Roraima'},
    '24' : {'code':'SC','name':'Santa Catarina'},
    '25' : {'code':'SP','name':'Sao Paulo'},
    '26' : {'code':'SE','name':'Sergipe'},
    '27' : {'code':'TO','name':'Tocantins'}
  },
  'IO':{
    '1' : {'code':'DG','name':'Diego Garcia'},
    '2' : {'code':'DI','name':'Danger Island'},
    '3' : {'code':'EA','name':'Eagle Islands'},
    '4' : {'code':'EG','name':'Egmont Islands'},
    '5' : {'code':'NI','name':'Nelsons Island'},
    '6' : {'code':'PB','name':'Peros Banhos'},
    '7' : {'code':'SI','name':'Salomon Islands'},
    '8' : {'code':'TB','name':'Three Brothers'}
  },
  'BN':{
    '1' : {'code':'BEL','name':'Belait'},
    '2' : {'code':'BRM','name':'Brunei and Muara'},
    '3' : {'code':'TEM','name':'Temburong'},
    '4' : {'code':'TUT','name':'Tutong'}
  },
  'BG':{
    '1' : {'code':'BG-01','name':'Blagoevgrad'},
    '2' : {'code':'BG-02','name':'Burgas'},
    '3' : {'code':'BG-03','name':'Dobrich'},
    '4' : {'code':'BG-04','name':'Gabrovo'},
    '5' : {'code':'BG-05','name':'Haskovo'},
    '6' : {'code':'BG-06','name':'Kardjali'},
    '7' : {'code':'BG-07','name':'Kyustendil'},
    '8' : {'code':'BG-08','name':'Lovech'},
    '9' : {'code':'BG-09','name':'Montana'},
    '10' : {'code':'BG-10','name':'Pazardjik'},
    '11' : {'code':'BG-11','name':'Pernik'},
    '12' : {'code':'BG-12','name':'Pleven'},
    '13' : {'code':'BG-13','name':'Plovdiv'},
    '14' : {'code':'BG-14','name':'Razgrad'},
    '15' : {'code':'BG-15','name':'Shumen'},
    '16' : {'code':'BG-16','name':'Silistra'},
    '17' : {'code':'BG-17','name':'Sliven'},
    '18' : {'code':'BG-18','name':'Smolyan'},
    '19' : {'code':'BG-19','name':'Sofia'},
    '20' : {'code':'BG-20','name':'Sofia - town'},
    '21' : {'code':'BG-21','name':'Stara Zagora'},
    '22' : {'code':'BG-22','name':'Targovishte'},
    '23' : {'code':'BG-23','name':'Varna'},
    '24' : {'code':'BG-24','name':'Veliko Tarnovo'},
    '25' : {'code':'BG-25','name':'Vidin'},
    '26' : {'code':'BG-26','name':'Vratza'},
    '27' : {'code':'BG-27','name':'Yambol'}
  },
  'BF':{
    '1' : {'code':'BAL','name':'Bale'},
    '2' : {'code':'BAM','name':'Bam'},
    '3' : {'code':'BAN','name':'Banwa'},
    '4' : {'code':'BAZ','name':'Bazega'},
    '5' : {'code':'BOR','name':'Bougouriba'},
    '6' : {'code':'BLG','name':'Boulgou'},
    '7' : {'code':'BOK','name':'Boulkiemde'},
    '8' : {'code':'COM','name':'Comoe'},
    '9' : {'code':'GAN','name':'Ganzourgou'},
    '10' : {'code':'GNA','name':'Gnagna'},
    '11' : {'code':'GOU','name':'Gourma'},
    '12' : {'code':'HOU','name':'Houet'},
    '13' : {'code':'IOA','name':'Ioba'},
    '14' : {'code':'KAD','name':'Kadiogo'},
    '15' : {'code':'KEN','name':'Kenedougou'},
    '16' : {'code':'KOD','name':'Komondjari'},
    '17' : {'code':'KOP','name':'Kompienga'},
    '18' : {'code':'KOS','name':'Kossi'},
    '19' : {'code':'KOL','name':'Koulpelogo'},
    '20' : {'code':'KOT','name':'Kouritenga'},
    '21' : {'code':'KOW','name':'Kourweogo'},
    '22' : {'code':'LER','name':'Leraba'},
    '23' : {'code':'LOR','name':'Loroum'},
    '24' : {'code':'MOU','name':'Mouhoun'},
    '25' : {'code':'NAH','name':'Nahouri'},
    '26' : {'code':'NAM','name':'Namentenga'},
    '27' : {'code':'NAY','name':'Nayala'},
    '28' : {'code':'NOU','name':'Noumbiel'},
    '29' : {'code':'OUB','name':'Oubritenga'},
    '30' : {'code':'OUD','name':'Oudalan'},
    '31' : {'code':'PAS','name':'Passore'},
    '32' : {'code':'PON','name':'Poni'},
    '33' : {'code':'SAG','name':'Sanguie'},
    '34' : {'code':'SAM','name':'Sanmatenga'},
    '35' : {'code':'SEN','name':'Seno'},
    '36' : {'code':'SIS','name':'Sissili'},
    '37' : {'code':'SOM','name':'Soum'},
    '38' : {'code':'SOR','name':'Sourou'},
    '39' : {'code':'TAP','name':'Tapoa'},
    '40' : {'code':'TUY','name':'Tuy'},
    '41' : {'code':'YAG','name':'Yagha'},
    '42' : {'code':'YAT','name':'Yatenga'},
    '43' : {'code':'ZIR','name':'Ziro'},
    '44' : {'code':'ZOD','name':'Zondoma'},
    '45' : {'code':'ZOW','name':'Zoundweogo'}
  },
  'BI':{
    '1' : {'code':'BB','name':'Bubanza'},
    '2' : {'code':'BJ','name':'Bujumbura'},
    '3' : {'code':'BR','name':'Bururi'},
    '4' : {'code':'CA','name':'Cankuzo'},
    '5' : {'code':'CI','name':'Cibitoke'},
    '6' : {'code':'GI','name':'Gitega'},
    '7' : {'code':'KR','name':'Karuzi'},
    '8' : {'code':'KY','name':'Kayanza'},
    '9' : {'code':'KI','name':'Kirundo'},
    '10' : {'code':'MA','name':'Makamba'},
    '11' : {'code':'MU','name':'Muramvya'},
    '12' : {'code':'MY','name':'Muyinga'},
    '13' : {'code':'MW','name':'Mwaro'},
    '14' : {'code':'NG','name':'Ngozi'},
    '15' : {'code':'RT','name':'Rutana'},
    '16' : {'code':'RY','name':'Ruyigi'}
  },
  'KH':{
    '1' : {'code':'BA','name':'Battambang'},
    '2' : {'code':'BM','name':'Banteay Meanchey'},
    '3' : {'code':'KB','name':'Keb'},
    '4' : {'code':'KK','name':'Kaoh Kong'},
    '5' : {'code':'KL','name':'Kandal'},
    '6' : {'code':'KM','name':'Kampong Cham'},
    '7' : {'code':'KN','name':'Kampong Chhnang'},
    '8' : {'code':'KO','name':'Kampong Som'},
    '9' : {'code':'KP','name':'Kampot'},
    '10' : {'code':'KR','name':'Kratie'},
    '11' : {'code':'KT','name':'Kampong Thom'},
    '12' : {'code':'KU','name':'Kampong Speu'},
    '13' : {'code':'MK','name':'Mondul Kiri'},
    '14' : {'code':'OM','name':'Oddar Meancheay'},
    '15' : {'code':'PA','name':'Pailin'},
    '16' : {'code':'PG','name':'Prey Veng'},
    '17' : {'code':'PP','name':'Phnom Penh'},
    '18' : {'code':'PR','name':'Preah Vihear'},
    '19' : {'code':'PS','name':'Preah Seihanu (Kompong Som or Si)'},
    '20' : {'code':'PU','name':'Pursat'},
    '21' : {'code':'RK','name':'Ratanak Kiri'},
    '22' : {'code':'SI','name':'Siemreap'},
    '23' : {'code':'SR','name':'Svay Rieng'},
    '24' : {'code':'ST','name':'Stung Treng'},
    '25' : {'code':'TK','name':'Takeo'}
  },
  'CM':{
    '1' : {'code':'ADA','name':'Adamawa (Adamaoua)'},
    '2' : {'code':'CEN','name':'Centre'},
    '3' : {'code':'EST','name':'East (Est)'},
    '4' : {'code':'EXN','name':'Extrême-Nord'},
    '5' : {'code':'LIT','name':'Littoral'},
    '6' : {'code':'NOR','name':'North (Nord)'},
    '7' : {'code':'NOT','name':'Northwest (Nord-Ouest)'},
    '8' : {'code':'OUE','name':'West (Ouest)'},
    '9' : {'code':'SUD','name':'South (Sud)'},
    '10' : {'code':'SOU','name':'Southwest (Sud-Ouest)'}
  },
  'CA':{
    '1' : {'code':'AB','name':'Alberta'},
    '2' : {'code':'BC','name':'British Columbia'},
    '3' : {'code':'MB','name':'Manitoba'},
    '4' : {'code':'NB','name':'New Brunswick'},
    '5' : {'code':'NL','name':'Newfoundland and Labrador'},
    '6' : {'code':'NT','name':'Northwest Territories'},
    '7' : {'code':'NS','name':'Nova Scotia'},
    '8' : {'code':'NU','name':'Nunavut'},
    '9' : {'code':'ON','name':'Ontario'},
    '10' : {'code':'PE','name':'Prince Edward Island'},
    '11' : {'code':'QC','name':'Québec'},
    '12' : {'code':'SK','name':'Saskatchewan'},
    '13' : {'code':'YT','name':'Yukon Territory'}
  },
  'CV':{
    '1' : {'code':'BV','name':'Boa Vista'},
    '2' : {'code':'BR','name':'Brava'},
    '3' : {'code':'CS','name':'Calheta de Sao Miguel'},
    '4' : {'code':'MA','name':'Maio'},
    '5' : {'code':'MO','name':'Mosteiros'},
    '6' : {'code':'PA','name':'Paul'},
    '7' : {'code':'PN','name':'Porto Novo'},
    '8' : {'code':'PR','name':'Praia'},
    '9' : {'code':'RG','name':'Ribeira Grande'},
    '10' : {'code':'SL','name':'Sal'},
    '11' : {'code':'CA','name':'Santa Catarina'},
    '12' : {'code':'CR','name':'Santa Cruz'},
    '13' : {'code':'SD','name':'Sao Domingos'},
    '14' : {'code':'SF','name':'Sao Filipe'},
    '15' : {'code':'SN','name':'Sao Nicolau'},
    '16' : {'code':'SV','name':'Sao Vicente'},
    '17' : {'code':'TA','name':'Tarrafal'}
  },
  'KY':{
    '1' : {'code':'CR','name':'Creek'},
    '2' : {'code':'EA','name':'Eastern'},
    '3' : {'code':'ML','name':'Midland'},
    '4' : {'code':'ST','name':'South Town'},
    '5' : {'code':'SP','name':'Spot Bay'},
    '6' : {'code':'SK','name':'Stake Bay'},
    '7' : {'code':'WD','name':'West End'},
    '8' : {'code':'WN','name':'Western'}
  },
  'CF':{
    '1' : {'code':'BAN','name':'Bangui'},
    '2' : {'code':'BBA','name':'Bamingui-Bangoran'},
    '3' : {'code':'BKO','name':'Basse-Kotto'},
    '4' : {'code':'HKO','name':'Haute-Kotto'},
    '5' : {'code':'HMB','name':'Haut-Mbomou'},
    '6' : {'code':'KEM','name':'Kemo'},
    '7' : {'code':'LOB','name':'Lobaye'},
    '8' : {'code':'MBO','name':'Mbomou'},
    '9' : {'code':'MKD','name':'Mambéré-Kadéï'},
    '10' : {'code':'NGR','name':'Nana-Grebizi'},
    '11' : {'code':'NMM','name':'Nana-Mambere'},
    '12' : {'code':'OMP','name':'Ombella-M\'Poko'},
    '13' : {'code':'OPE','name':'Ouham-Pende'},
    '14' : {'code':'OUH','name':'Ouham'},
    '15' : {'code':'OUK','name':'Ouaka'},
    '16' : {'code':'SMB','name':'Sangha-Mbaere'},
    '17' : {'code':'VAK','name':'Vakaga'}
  },
  'TD':{
    '1' : {'code':'BA','name':'Batha'},
    '2' : {'code':'BI','name':'Biltine'},
    '3' : {'code':'BE','name':'Borkou-Ennedi-Tibesti'},
    '4' : {'code':'CB','name':'Chari-Baguirmi'},
    '5' : {'code':'GU','name':'Guera'},
    '6' : {'code':'KA','name':'Kanem'},
    '7' : {'code':'LA','name':'Lac'},
    '8' : {'code':'LC','name':'Logone Occidental'},
    '9' : {'code':'LR','name':'Logone Oriental'},
    '10' : {'code':'MK','name':'Mayo-Kebbi'},
    '11' : {'code':'MC','name':'Moyen-Chari'},
    '12' : {'code':'OU','name':'Ouaddai'},
    '13' : {'code':'SA','name':'Salamat'},
    '14' : {'code':'TA','name':'Tandjile'}
  },
  'CL':{
    '1' : {'code':'AI','name':'Aisen del General Carlos Ibanez'},
    '2' : {'code':'AN','name':'Antofagasta'},
    '3' : {'code':'AR','name':'Araucania'},
    '4' : {'code':'AT','name':'Atacama'},
    '5' : {'code':'BI','name':'Bio-Bio'},
    '6' : {'code':'CO','name':'Coquimbo'},
    '7' : {'code':'LI','name':'Libertador General Bernardo O\'Hi'},
    '8' : {'code':'LL','name':'Los Lagos'},
    '9' : {'code':'MA','name':'Magallanes y de la Antartica Chi'},
    '10' : {'code':'ML','name':'Maule'},
    '11' : {'code':'RM','name':'Region Metropolitana'},
    '12' : {'code':'TA','name':'Tarapaca'},
    '13' : {'code':'VS','name':'Valparaiso'}
  },
  'CN':{
    '1' : {'code':'AN','name':'Anhui'},
    '2' : {'code':'BE','name':'Beijing'},
    '3' : {'code':'CH','name':'Chongqing'},
    '4' : {'code':'FU','name':'Fujian'},
    '5' : {'code':'GA','name':'Gansu'},
    '6' : {'code':'GU','name':'Guangdong'},
    '7' : {'code':'GX','name':'Guangxi'},
    '8' : {'code':'GZ','name':'Guizhou'},
    '9' : {'code':'HA','name':'Hainan'},
    '10' : {'code':'HB','name':'Hebei'},
    '11' : {'code':'HL','name':'Heilongjiang'},
    '12' : {'code':'HE','name':'Henan'},
    '13' : {'code':'HK','name':'Hong Kong'},
    '14' : {'code':'HU','name':'Hubei'},
    '15' : {'code':'HN','name':'Hunan'},
    '16' : {'code':'IM','name':'Inner Mongolia'},
    '17' : {'code':'JI','name':'Jiangsu'},
    '18' : {'code':'JX','name':'Jiangxi'},
    '19' : {'code':'JL','name':'Jilin'},
    '20' : {'code':'LI','name':'Liaoning'},
    '21' : {'code':'MA','name':'Macau'},
    '22' : {'code':'NI','name':'Ningxia'},
    '23' : {'code':'SH','name':'Shaanxi'},
    '24' : {'code':'SA','name':'Shandong'},
    '25' : {'code':'SG','name':'Shanghai'},
    '26' : {'code':'SX','name':'Shanxi'},
    '27' : {'code':'SI','name':'Sichuan'},
    '28' : {'code':'TI','name':'Tianjin'},
    '29' : {'code':'XI','name':'Xinjiang'},
    '30' : {'code':'YU','name':'Yunnan'},
    '31' : {'code':'ZH','name':'Zhejiang'}
  },
  'CC':{
    '1' : {'code':'D','name':'Direction Island'},
    '2' : {'code':'H','name':'Home Island'},
    '3' : {'code':'O','name':'Horsburgh Island'},
    '4' : {'code':'S','name':'South Island'},
    '5' : {'code':'W','name':'West Island'}
  },
  'CO':{
    '1' : {'code':'AMZ','name':'Amazonas'},
    '2' : {'code':'ANT','name':'Antioquia'},
    '3' : {'code':'ARA','name':'Arauca'},
    '4' : {'code':'ATL','name':'Atlantico'},
    '5' : {'code':'BDC','name':'Bogota D.C.'},
    '6' : {'code':'BOL','name':'Bolivar'},
    '7' : {'code':'BOY','name':'Boyaca'},
    '8' : {'code':'CAL','name':'Caldas'},
    '9' : {'code':'CAQ','name':'Caqueta'},
    '10' : {'code':'CAS','name':'Casanare'},
    '11' : {'code':'CAU','name':'Cauca'},
    '12' : {'code':'CES','name':'Cesar'},
    '13' : {'code':'CHO','name':'Choco'},
    '14' : {'code':'COR','name':'Cordoba'},
    '15' : {'code':'CAM','name':'Cundinamarca'},
    '16' : {'code':'GNA','name':'Guainia'},
    '17' : {'code':'GJR','name':'Guajira'},
    '18' : {'code':'GVR','name':'Guaviare'},
    '19' : {'code':'HUI','name':'Huila'},
    '20' : {'code':'MAG','name':'Magdalena'},
    '21' : {'code':'MET','name':'Meta'},
    '22' : {'code':'NAR','name':'Narino'},
    '23' : {'code':'NDS','name':'Norte de Santander'},
    '24' : {'code':'PUT','name':'Putumayo'},
    '25' : {'code':'QUI','name':'Quindio'},
    '26' : {'code':'RIS','name':'Risaralda'},
    '27' : {'code':'SAP','name':'San Andres y Providencia'},
    '28' : {'code':'SAN','name':'Santander'},
    '29' : {'code':'SUC','name':'Sucre'},
    '30' : {'code':'TOL','name':'Tolima'},
    '31' : {'code':'VDC','name':'Valle del Cauca'},
    '32' : {'code':'VAU','name':'Vaupes'},
    '33' : {'code':'VIC','name':'Vichada'}
  },
  'KM':{
    '1' : {'code':'G','name':'Grande Comore'},
    '2' : {'code':'A','name':'Anjouan'},
    '3' : {'code':'M','name':'Moheli'}
  },
  'CG':{
    '1' : {'code':'BO','name':'Bouenza'},
    '2' : {'code':'BR','name':'Brazzaville'},
    '3' : {'code':'CU','name':'Cuvette'},
    '4' : {'code':'CO','name':'Cuvette-Ouest'},
    '5' : {'code':'KO','name':'Kouilou'},
    '6' : {'code':'LE','name':'Lekoumou'},
    '7' : {'code':'LI','name':'Likouala'},
    '8' : {'code':'NI','name':'Niari'},
    '9' : {'code':'PL','name':'Plateaux'},
    '10' : {'code':'PO','name':'Pool'},
    '11' : {'code':'SA','name':'Sangha'}
  },
  'CK':{
    '1' : {'code':'AI','name':'Aitutaki'},
    '2' : {'code':'AT','name':'Atiu'},
    '3' : {'code':'MA','name':'Manuae'},
    '4' : {'code':'MG','name':'Mangaia'},
    '5' : {'code':'MK','name':'Manihiki'},
    '6' : {'code':'MT','name':'Mitiaro'},
    '7' : {'code':'MU','name':'Mauke'},
    '8' : {'code':'NI','name':'Nassau Island'},
    '9' : {'code':'PA','name':'Palmerston'},
    '10' : {'code':'PE','name':'Penrhyn'},
    '11' : {'code':'PU','name':'Pukapuka'},
    '12' : {'code':'RK','name':'Rakahanga'},
    '13' : {'code':'RR','name':'Rarotonga'},
    '14' : {'code':'SU','name':'Surwarrow'},
    '15' : {'code':'TA','name':'Takutea'}
  },
  'CR':{
    '1' : {'code':'AL','name':'Alajuela'},
    '2' : {'code':'CA','name':'Cartago'},
    '3' : {'code':'GU','name':'Guanacaste'},
    '4' : {'code':'HE','name':'Heredia'},
    '5' : {'code':'LI','name':'Limon'},
    '6' : {'code':'PU','name':'Puntarenas'},
    '7' : {'code':'SJ','name':'San Jose'}
  },
  'CI':{
    '1' : {'code':'ABE','name':'Abengourou'},
    '2' : {'code':'ABI','name':'Abidjan'},
    '3' : {'code':'ABO','name':'Aboisso'},
    '4' : {'code':'ADI','name':'Adiake'},
    '5' : {'code':'ADZ','name':'Adzope'},
    '6' : {'code':'AGB','name':'Agboville'},
    '7' : {'code':'AGN','name':'Agnibilekrou'},
    '8' : {'code':'ALE','name':'Alepe'},
    '9' : {'code':'BOC','name':'Bocanda'},
    '10' : {'code':'BAN','name':'Bangolo'},
    '11' : {'code':'BEO','name':'Beoumi'},
    '12' : {'code':'BIA','name':'Biankouma'},
    '13' : {'code':'BDK','name':'Bondoukou'},
    '14' : {'code':'BGN','name':'Bongouanou'},
    '15' : {'code':'BFL','name':'Bouafle'},
    '16' : {'code':'BKE','name':'Bouake'},
    '17' : {'code':'BNA','name':'Bouna'},
    '18' : {'code':'BDL','name':'Boundiali'},
    '19' : {'code':'DKL','name':'Dabakala'},
    '20' : {'code':'DBU','name':'Dabou'},
    '21' : {'code':'DAL','name':'Daloa'},
    '22' : {'code':'DAN','name':'Danane'},
    '23' : {'code':'DAO','name':'Daoukro'},
    '24' : {'code':'DIM','name':'Dimbokro'},
    '25' : {'code':'DIV','name':'Divo'},
    '26' : {'code':'DUE','name':'Duekoue'},
    '27' : {'code':'FER','name':'Ferkessedougou'},
    '28' : {'code':'GAG','name':'Gagnoa'},
    '29' : {'code':'GBA','name':'Grand-Bassam'},
    '30' : {'code':'GLA','name':'Grand-Lahou'},
    '31' : {'code':'GUI','name':'Guiglo'},
    '32' : {'code':'ISS','name':'Issia'},
    '33' : {'code':'JAC','name':'Jacqueville'},
    '34' : {'code':'KAT','name':'Katiola'},
    '35' : {'code':'KOR','name':'Korhogo'},
    '36' : {'code':'LAK','name':'Lakota'},
    '37' : {'code':'MAN','name':'Man'},
    '38' : {'code':'MKN','name':'Mankono'},
    '39' : {'code':'MBA','name':'Mbahiakro'},
    '40' : {'code':'ODI','name':'Odienne'},
    '41' : {'code':'OUM','name':'Oume'},
    '42' : {'code':'SAK','name':'Sakassou'},
    '43' : {'code':'SPE','name':'San-Pedro'},
    '44' : {'code':'SAS','name':'Sassandra'},
    '45' : {'code':'SEG','name':'Seguela'},
    '46' : {'code':'SIN','name':'Sinfra'},
    '47' : {'code':'SOU','name':'Soubre'},
    '48' : {'code':'TAB','name':'Tabou'},
    '49' : {'code':'TAN','name':'Tanda'},
    '50' : {'code':'TIE','name':'Tiebissou'},
    '51' : {'code':'TIN','name':'Tingrela'},
    '52' : {'code':'TIA','name':'Tiassale'},
    '53' : {'code':'TBA','name':'Touba'},
    '54' : {'code':'TLP','name':'Toulepleu'},
    '55' : {'code':'TMD','name':'Toumodi'},
    '56' : {'code':'VAV','name':'Vavoua'},
    '57' : {'code':'YAM','name':'Yamoussoukro'},
    '58' : {'code':'ZUE','name':'Zuenoula'}
  },
  'HR':{
    '1' : {'code':'BB','name':'Bjelovar-Bilogora'},
    '2' : {'code':'CZ','name':'City of Zagreb'},
    '3' : {'code':'DN','name':'Dubrovnik-Neretva'},
    '4' : {'code':'IS','name':'Istra'},
    '5' : {'code':'KA','name':'Karlovac'},
    '6' : {'code':'KK','name':'Koprivnica-Krizevci'},
    '7' : {'code':'KZ','name':'Krapina-Zagorje'},
    '8' : {'code':'LS','name':'Lika-Senj'},
    '9' : {'code':'ME','name':'Medimurje'},
    '10' : {'code':'OB','name':'Osijek-Baranja'},
    '11' : {'code':'PS','name':'Pozega-Slavonia'},
    '12' : {'code':'PG','name':'Primorje-Gorski Kotar'},
    '13' : {'code':'SI','name':'Sibenik'},
    '14' : {'code':'SM','name':'Sisak-Moslavina'},
    '15' : {'code':'SB','name':'Slavonski Brod-Posavina'},
    '16' : {'code':'SD','name':'Split-Dalmatia'},
    '17' : {'code':'VA','name':'Varazdin'},
    '18' : {'code':'VP','name':'Virovitica-Podravina'},
    '19' : {'code':'VS','name':'Vukovar-Srijem'},
    '20' : {'code':'ZK','name':'Zadar-Knin'},
    '21' : {'code':'ZA','name':'Zagreb'}
  },
  'CU':{
    '1' : {'code':'CA','name':'Camaguey'},
    '2' : {'code':'CD','name':'Ciego de Avila'},
    '3' : {'code':'CI','name':'Cienfuegos'},
    '4' : {'code':'CH','name':'Ciudad de La Habana'},
    '5' : {'code':'GR','name':'Granma'},
    '6' : {'code':'GU','name':'Guantanamo'},
    '7' : {'code':'HO','name':'Holguin'},
    '8' : {'code':'IJ','name':'Isla de la Juventud'},
    '9' : {'code':'LH','name':'La Habana'},
    '10' : {'code':'LT','name':'Las Tunas'},
    '11' : {'code':'MA','name':'Matanzas'},
    '12' : {'code':'PR','name':'Pinar del Rio'},
    '13' : {'code':'SS','name':'Sancti Spiritus'},
    '14' : {'code':'SC','name':'Santiago de Cuba'},
    '15' : {'code':'VC','name':'Villa Clara'}
  },
  'CY':{
    '1' : {'code':'F','name':'Famagusta'},
    '2' : {'code':'K','name':'Kyrenia'},
    '3' : {'code':'A','name':'Larnaca'},
    '4' : {'code':'I','name':'Limassol'},
    '5' : {'code':'N','name':'Nicosia'},
    '6' : {'code':'P','name':'Paphos'}
  },
  'CZ':{
    '1' : {'code':'A','name':'Hlavní město Praha'},
    '2' : {'code':'B','name':'Jihomoravský'},
    '3' : {'code':'C','name':'Jihočeský'},
    '4' : {'code':'E','name':'Pardubický'},
    '5' : {'code':'H','name':'Královéhradecký'},
    '6' : {'code':'J','name':'Vysočina'},
    '7' : {'code':'K','name':'Karlovarský'},
    '8' : {'code':'L','name':'Liberecký'},
    '9' : {'code':'M','name':'Olomoucký'},
    '10' : {'code':'P','name':'Plzeňský'},
    '11' : {'code':'S','name':'Středočeský'},
    '12' : {'code':'T','name':'Moravskoslezský'},
    '13' : {'code':'U','name':'Ústecký'},
    '14' : {'code':'Z','name':'Zlínský'}
  },
  'DK':{
    '1' : {'code':'AR','name':'Arhus'},
    '2' : {'code':'BH','name':'Bornholm'},
    '3' : {'code':'CO','name':'Copenhagen'},
    '4' : {'code':'FO','name':'Faroe Islands'},
    '5' : {'code':'FR','name':'Frederiksborg'},
    '6' : {'code':'FY','name':'Fyn'},
    '7' : {'code':'KO','name':'Kobenhavn'},
    '8' : {'code':'NO','name':'Nordjylland'},
    '9' : {'code':'RI','name':'Ribe'},
    '10' : {'code':'RK','name':'Ringkobing'},
    '11' : {'code':'RO','name':'Roskilde'},
    '12' : {'code':'SO','name':'Sonderjylland'},
    '13' : {'code':'ST','name':'Storstrom'},
    '14' : {'code':'VK','name':'Vejle'},
    '15' : {'code':'VJ','name':'Vestjælland'},
    '16' : {'code':'VB','name':'Viborg'}
  },
  'DJ':{
    '1' : {'code':'S','name':'\'Ali Sabih'},
    '2' : {'code':'K','name':'Dikhil'},
    '3' : {'code':'J','name':'Djibouti'},
    '4' : {'code':'O','name':'Obock'},
    '5' : {'code':'T','name':'Tadjoura'}
  },
  'DM':{
    '1' : {'code':'AND','name':'Saint Andrew Parish'},
    '2' : {'code':'DAV','name':'Saint David Parish'},
    '3' : {'code':'GEO','name':'Saint George Parish'},
    '4' : {'code':'JOH','name':'Saint John Parish'},
    '5' : {'code':'JOS','name':'Saint Joseph Parish'},
    '6' : {'code':'LUK','name':'Saint Luke Parish'},
    '7' : {'code':'MAR','name':'Saint Mark Parish'},
    '8' : {'code':'PAT','name':'Saint Patrick Parish'},
    '9' : {'code':'PAU','name':'Saint Paul Parish'},
    '10' : {'code':'PET','name':'Saint Peter Parish'}
  },
  'DO':{
    '1' : {'code':'DN','name':'Distrito Nacional'},
    '2' : {'code':'AZ','name':'Azua'},
    '3' : {'code':'BC','name':'Baoruco'},
    '4' : {'code':'BH','name':'Barahona'},
    '5' : {'code':'DJ','name':'Dajabon'},
    '6' : {'code':'DU','name':'Duarte'},
    '7' : {'code':'EL','name':'Elias Pina'},
    '8' : {'code':'SY','name':'El Seybo'},
    '9' : {'code':'ET','name':'Espaillat'},
    '10' : {'code':'HM','name':'Hato Mayor'},
    '11' : {'code':'IN','name':'Independencia'},
    '12' : {'code':'AL','name':'La Altagracia'},
    '13' : {'code':'RO','name':'La Romana'},
    '14' : {'code':'VE','name':'La Vega'},
    '15' : {'code':'MT','name':'Maria Trinidad Sanchez'},
    '16' : {'code':'MN','name':'Monsenor Nouel'},
    '17' : {'code':'MC','name':'Monte Cristi'},
    '18' : {'code':'MP','name':'Monte Plata'},
    '19' : {'code':'PD','name':'Pedernales'},
    '20' : {'code':'PR','name':'Peravia (Bani)'},
    '21' : {'code':'PP','name':'Puerto Plata'},
    '22' : {'code':'SL','name':'Salcedo'},
    '23' : {'code':'SM','name':'Samana'},
    '24' : {'code':'SH','name':'Sanchez Ramirez'},
    '25' : {'code':'SC','name':'San Cristobal'},
    '26' : {'code':'JO','name':'San Jose de Ocoa'},
    '27' : {'code':'SJ','name':'San Juan'},
    '28' : {'code':'PM','name':'San Pedro de Macoris'},
    '29' : {'code':'SA','name':'Santiago'},
    '30' : {'code':'ST','name':'Santiago Rodriguez'},
    '31' : {'code':'SD','name':'Santo Domingo'},
    '32' : {'code':'VA','name':'Valverde'}
  },
  'TP':{
    '1' : {'code':'AL','name':'Aileu'},
    '2' : {'code':'AN','name':'Ainaro'},
    '3' : {'code':'BA','name':'Baucau'},
    '4' : {'code':'BO','name':'Bobonaro'},
    '5' : {'code':'CO','name':'Cova Lima'},
    '6' : {'code':'DI','name':'Dili'},
    '7' : {'code':'ER','name':'Ermera'},
    '8' : {'code':'LA','name':'Lautem'},
    '9' : {'code':'LI','name':'Liquica'},
    '10' : {'code':'MT','name':'Manatuto'},
    '11' : {'code':'MF','name':'Manufahi'},
    '12' : {'code':'OE','name':'Oecussi'},
    '13' : {'code':'VI','name':'Viqueque'}
  },
  'EC':{
    '1' : {'code':'AZU','name':'Azuay'},
    '2' : {'code':'BOL','name':'Bolivar'},
    '3' : {'code':'CAN','name':'Cañar'},
    '4' : {'code':'CAR','name':'Carchi'},
    '5' : {'code':'CHI','name':'Chimborazo'},
    '6' : {'code':'COT','name':'Cotopaxi'},
    '7' : {'code':'EOR','name':'El Oro'},
    '8' : {'code':'ESM','name':'Esmeraldas'},
    '9' : {'code':'GPS','name':'Galápagos'},
    '10' : {'code':'GUA','name':'Guayas'},
    '11' : {'code':'IMB','name':'Imbabura'},
    '12' : {'code':'LOJ','name':'Loja'},
    '13' : {'code':'LRO','name':'Los Ríos'},
    '14' : {'code':'MAN','name':'Manabí'},
    '15' : {'code':'MSA','name':'Morona Santiago'},
    '16' : {'code':'NAP','name':'Napo'},
    '17' : {'code':'ORE','name':'Orellana'},
    '18' : {'code':'PAS','name':'Pastaza'},
    '19' : {'code':'PIC','name':'Pichincha'},
    '20' : {'code':'SUC','name':'Sucumbíos'},
    '21' : {'code':'TUN','name':'Tungurahua'},
    '22' : {'code':'ZCH','name':'Zamora Chinchipe'}
  },
  'EG':{
    '1' : {'code':'DHY','name':'Ad Daqahliyah'},
    '2' : {'code':'BAM','name':'Al Bahr al Ahmar'},
    '3' : {'code':'BHY','name':'Al Buhayrah'},
    '4' : {'code':'FYM','name':'Al Fayyum'},
    '5' : {'code':'GBY','name':'Al Gharbiyah'},
    '6' : {'code':'IDR','name':'Al Iskandariyah'},
    '7' : {'code':'IML','name':'Al Isma \'iliyah'},
    '8' : {'code':'JZH','name':'Al Jizah'},
    '9' : {'code':'MFY','name':'Al Minufiyah'},
    '10' : {'code':'MNY','name':'Al Minya'},
    '11' : {'code':'QHR','name':'Al Qahirah'},
    '12' : {'code':'QLY','name':'Al Qalyubiyah'},
    '13' : {'code':'WJD','name':'Al Wadi al Jadid'},
    '14' : {'code':'SHQ','name':'Ash Sharqiyah'},
    '15' : {'code':'SWY','name':'As Suways'},
    '16' : {'code':'ASW','name':'Aswan'},
    '17' : {'code':'ASY','name':'Asyut'},
    '18' : {'code':'BSW','name':'Bani Suwayf'},
    '19' : {'code':'BSD','name':'Bur Sa\'id'},
    '20' : {'code':'DMY','name':'Dumyat'},
    '21' : {'code':'JNS','name':'Janub Sina\''},
    '22' : {'code':'KSH','name':'Kafr ash Shaykh'},
    '23' : {'code':'MAT','name':'Matruh'},
    '24' : {'code':'QIN','name':'Qina'},
    '25' : {'code':'SHS','name':'Shamal Sina\''},
    '26' : {'code':'SUH','name':'Suhaj'}
  },
  'SV':{
    '1' : {'code':'AH','name':'Ahuachapan'},
    '2' : {'code':'CA','name':'Cabanas'},
    '3' : {'code':'CH','name':'Chalatenango'},
    '4' : {'code':'CU','name':'Cuscatlan'},
    '5' : {'code':'LB','name':'La Libertad'},
    '6' : {'code':'PZ','name':'La Paz'},
    '7' : {'code':'UN','name':'La Union'},
    '8' : {'code':'MO','name':'Morazan'},
    '9' : {'code':'SM','name':'San Miguel'},
    '10' : {'code':'SS','name':'San Salvador'},
    '11' : {'code':'SV','name':'San Vicente'},
    '12' : {'code':'SA','name':'Santa Ana'},
    '13' : {'code':'SO','name':'Sonsonate'},
    '14' : {'code':'US','name':'Usulutan'}
  },
  'GQ':{
    '1' : {'code':'AN','name':'Provincia Annobon'},
    '2' : {'code':'BN','name':'Provincia Bioko Norte'},
    '3' : {'code':'BS','name':'Provincia Bioko Sur'},
    '4' : {'code':'CS','name':'Provincia Centro Sur'},
    '5' : {'code':'KN','name':'Provincia Kie-Ntem'},
    '6' : {'code':'LI','name':'Provincia Litoral'},
    '7' : {'code':'WN','name':'Provincia Wele-Nzas'}
  },
  'ER':{
    '1' : {'code':'MA','name':'Central (Maekel)'},
    '2' : {'code':'KE','name':'Anseba (Keren)'},
    '3' : {'code':'DK','name':'Southern Red Sea (Debub-Keih-Bah)'},
    '4' : {'code':'SK','name':'Northern Red Sea (Semien-Keih-Ba)'},
    '5' : {'code':'DE','name':'Southern (Debub)'},
    '6' : {'code':'BR','name':'Gash-Barka (Barentu)'}
  },
  'EE':{
    '1' : {'code':'HA','name':'Harjumaa (Tallinn)'},
    '2' : {'code':'HI','name':'Hiiumaa (Kardla)'},
    '3' : {'code':'IV','name':'Ida-Virumaa (Johvi)'},
    '4' : {'code':'JA','name':'Jarvamaa (Paide)'},
    '5' : {'code':'JO','name':'Jogevamaa (Jogeva)'},
    '6' : {'code':'LV','name':'Laane-Virumaa (Rakvere)'},
    '7' : {'code':'LA','name':'Laanemaa (Haapsalu)'},
    '8' : {'code':'PA','name':'Parnumaa (Parnu)'},
    '9' : {'code':'PO','name':'Polvamaa (Polva)'},
    '10' : {'code':'RA','name':'Raplamaa (Rapla)'},
    '11' : {'code':'SA','name':'Saaremaa (Kuessaare)'},
    '12' : {'code':'TA','name':'Tartumaa (Tartu)'},
    '13' : {'code':'VA','name':'Valgamaa (Valga)'},
    '14' : {'code':'VI','name':'Viljandimaa (Viljandi)'},
    '15' : {'code':'VO','name':'Vorumaa (Voru)'}
  },
  'ET':{
    '1' : {'code':'AF','name':'Afar'},
    '2' : {'code':'AH','name':'Amhara'},
    '3' : {'code':'BG','name':'Benishangul-Gumaz'},
    '4' : {'code':'GB','name':'Gambela'},
    '5' : {'code':'HR','name':'Hariai'},
    '6' : {'code':'OR','name':'Oromia'},
    '7' : {'code':'SM','name':'Somali'},
    '8' : {'code':'SN','name':'Southern Nations - Nationalities'},
    '9' : {'code':'TG','name':'Tigray'},
    '10' : {'code':'AA','name':'Addis Ababa'},
    '11' : {'code':'DD','name':'Dire Dawa'}
  },
  'FO':{
    '1' : {'code':'TÛR','name':'Tûrshavnar Kommuna'},
    '2' : {'code':'KLA','name':'Klaksvík'},
    '3' : {'code':'RUN','name':'Runavík'},
    '4' : {'code':'TVØ','name':'Tvøroyri'},
    '5' : {'code':'FUG','name':'Fuglafjørður'},
    '6' : {'code':'SUN','name':'Sunda Kommuna'},
    '7' : {'code':'VáG','name':'Vágur'},
    '8' : {'code':'NES','name':'Nes'},
    '9' : {'code':'VES','name':'Vestmanna'},
    '10' : {'code':'MIð','name':'Miðvágur'},
    '11' : {'code':'SØR','name':'Sørvágur'},
    '12' : {'code':'GØT','name':'Gøtu Kommuna'},
    '13' : {'code':'SJû','name':'Sjûvar Kommuna'},
    '14' : {'code':'LEI','name':'Leirvík'},
    '15' : {'code':'SAN','name':'Sandavágur'},
    '16' : {'code':'HVA','name':'Hvalba'},
    '17' : {'code':'EIð','name':'Eiði'},
    '18' : {'code':'KVí','name':'Kvívík'},
    '19' : {'code':'SAN','name':'Sandur'},
    '20' : {'code':'SKO','name':'Skopun'},
    '21' : {'code':'HVA','name':'Hvannasund'},
    '22' : {'code':'SUM','name':'Sumba'},
    '23' : {'code':'VIð','name':'Viðareiði'},
    '24' : {'code':'POR','name':'Porkeri'},
    '25' : {'code':'SKá','name':'Skálavík'},
    '26' : {'code':'KUN','name':'Kunoy'},
    '27' : {'code':'HÚS','name':'HÚsavík'},
    '28' : {'code':'HOV','name':'Hov'},
    '29' : {'code':'FáM','name':'Fámjin'},
    '30' : {'code':'FUN','name':'Funningur'},
    '31' : {'code':'HÚS','name':'HÚsar'},
    '32' : {'code':'SKÚ','name':'SkÚvoy'},
    '33' : {'code':'SVí','name':'Svínoy'},
    '34' : {'code':'FUG','name':'Fugloy'}
  },
  'FJ':{
    '1' : {'code':'C','name':'Central Division'},
    '2' : {'code':'E','name':'Eastern Division'},
    '3' : {'code':'N','name':'Northern Division'},
    '4' : {'code':'R','name':'Rotuma'},
    '5' : {'code':'W','name':'Western Division'}
  },
  'FI':{
    '1' : {'code':'AL','name':'Ahvenanmaan Laani'},
    '2' : {'code':'ES','name':'Etela-Suomen Laani'},
    '3' : {'code':'IS','name':'Ita-Suomen Laani'},
    '4' : {'code':'LS','name':'Lansi-Suomen Laani'},
    '5' : {'code':'LA','name':'Lapin Lanani'},
    '6' : {'code':'OU','name':'Oulun Laani'}
  },
  'FR':{
    '1' : {'code':'AL','name':'Alsace'},
    '2' : {'code':'AQ','name':'Aquitaine'},
    '3' : {'code':'AU','name':'Auvergne'},
    '4' : {'code':'BR','name':'Brittany'},
    '5' : {'code':'BU','name':'Burgundy'},
    '6' : {'code':'CE','name':'Center Loire Valley'},
    '7' : {'code':'CH','name':'Champagne'},
    '8' : {'code':'CO','name':'Corse'},
    '9' : {'code':'FR','name':'France Comte'},
    '10' : {'code':'LA','name':'Languedoc Roussillon'},
    '11' : {'code':'LI','name':'Limousin'},
    '12' : {'code':'LO','name':'Lorraine'},
    '13' : {'code':'MI','name':'Midi Pyrenees'},
    '14' : {'code':'NO','name':'Nord Pas de Calais'},
    '15' : {'code':'NR','name':'Normandy'},
    '16' : {'code':'PA','name':'Paris / Ile de France'},
    '17' : {'code':'PI','name':'Picardie'},
    '18' : {'code':'PO','name':'Poitou Charente'},
    '19' : {'code':'PR','name':'Provence'},
    '20' : {'code':'RH','name':'Rhone Alps'},
    '21' : {'code':'RI','name':'Riviera'},
    '22' : {'code':'WE','name':'Western Loire Valley'}
  },
  'FX':{
    '1' : {'code':'Et','name':'Etranger'},
    '2' : {'code':'01','name':'Ain'},
    '3' : {'code':'02','name':'Aisne'},
    '4' : {'code':'03','name':'Allier'},
    '5' : {'code':'04','name':'Alpes de Haute Provence'},
    '6' : {'code':'05','name':'Hautes-Alpes'},
    '7' : {'code':'06','name':'Alpes Maritimes'},
    '8' : {'code':'07','name':'Ardèche'},
    '9' : {'code':'08','name':'Ardennes'},
    '10' : {'code':'09','name':'Ariège'},
    '11' : {'code':'10','name':'Aube'},
    '12' : {'code':'11','name':'Aude'},
    '13' : {'code':'12','name':'Aveyron'},
    '14' : {'code':'13','name':'Bouches du Rhône'},
    '15' : {'code':'14','name':'Calvados'},
    '16' : {'code':'15','name':'Cantal'},
    '17' : {'code':'16','name':'Charente'},
    '18' : {'code':'17','name':'Charente Maritime'},
    '19' : {'code':'18','name':'Cher'},
    '20' : {'code':'19','name':'Corrèze'},
    '21' : {'code':'2A','name':'Corse du Sud'},
    '22' : {'code':'2B','name':'Haute Corse'},
    '23' : {'code':'21','name':'Côte d\'or'},
    '24' : {'code':'22','name':'Côtes d\'Armor'},
    '25' : {'code':'23','name':'Creuse'},
    '26' : {'code':'24','name':'Dordogne'},
    '27' : {'code':'25','name':'Doubs'},
    '28' : {'code':'26','name':'Drôme'},
    '29' : {'code':'27','name':'Eure'},
    '30' : {'code':'28','name':'Eure et Loir'},
    '31' : {'code':'29','name':'Finistère'},
    '32' : {'code':'30','name':'Gard'},
    '33' : {'code':'31','name':'Haute Garonne'},
    '34' : {'code':'32','name':'Gers'},
    '35' : {'code':'33','name':'Gironde'},
    '36' : {'code':'34','name':'Hérault'},
    '37' : {'code':'35','name':'Ille et Vilaine'},
    '38' : {'code':'36','name':'Indre'},
    '39' : {'code':'37','name':'Indre et Loire'},
    '40' : {'code':'38','name':'Isére'},
    '41' : {'code':'39','name':'Jura'},
    '42' : {'code':'40','name':'Landes'},
    '43' : {'code':'41','name':'Loir et Cher'},
    '44' : {'code':'42','name':'Loire'},
    '45' : {'code':'43','name':'Haute Loire'},
    '46' : {'code':'44','name':'Loire Atlantique'},
    '47' : {'code':'45','name':'Loiret'},
    '48' : {'code':'46','name':'Lot'},
    '49' : {'code':'47','name':'Lot et Garonne'},
    '50' : {'code':'48','name':'Lozère'},
    '51' : {'code':'49','name':'Maine et Loire'},
    '52' : {'code':'50','name':'Manche'},
    '53' : {'code':'51','name':'Marne'},
    '54' : {'code':'52','name':'Haute Marne'},
    '55' : {'code':'53','name':'Mayenne'},
    '56' : {'code':'54','name':'Meurthe et Moselle'},
    '57' : {'code':'55','name':'Meuse'},
    '58' : {'code':'56','name':'Morbihan'},
    '59' : {'code':'57','name':'Moselle'},
    '60' : {'code':'58','name':'Nièvre'},
    '61' : {'code':'59','name':'Nord'},
    '62' : {'code':'60','name':'Oise'},
    '63' : {'code':'61','name':'Orne'},
    '64' : {'code':'62','name':'Pas de Calais'},
    '65' : {'code':'63','name':'Puy de Dôme'},
    '66' : {'code':'64','name':'Pyrenees Atlantique'},
    '67' : {'code':'65','name':'Hautes Pyrenees'},
    '68' : {'code':'66','name':'Pyrenees Orientale'},
    '69' : {'code':'67','name':'Bas Rhin'},
    '70' : {'code':'68','name':'Haut Rhin'},
    '71' : {'code':'69','name':'Rhône'},
    '72' : {'code':'70','name':'Haute Saône'},
    '73' : {'code':'71','name':'Saône et Loire'},
    '74' : {'code':'72','name':'Sarthe'},
    '75' : {'code':'73','name':'Savoie'},
    '76' : {'code':'74','name':'Haute Savoie'},
    '77' : {'code':'75','name':'Paris'},
    '78' : {'code':'76','name':'Seine Martitime'},
    '79' : {'code':'77','name':'Seine et Marne'},
    '80' : {'code':'78','name':'Yvelines'},
    '81' : {'code':'79','name':'Deux Sèvres'},
    '82' : {'code':'80','name':'Somme'},
    '83' : {'code':'81','name':'Tarn'},
    '84' : {'code':'82','name':'Tarn et Garonne'},
    '85' : {'code':'83','name':'Var'},
    '86' : {'code':'84','name':'Vaucluse'},
    '87' : {'code':'85','name':'Vendée'},
    '88' : {'code':'86','name':'Vienne'},
    '89' : {'code':'87','name':'Haute Vienne'},
    '90' : {'code':'88','name':'Vosges'},
    '91' : {'code':'89','name':'Yonne'},
    '92' : {'code':'90','name':'Territoire de Belfort'},
    '93' : {'code':'91','name':'Essonne'},
    '94' : {'code':'92','name':'Hauts de Seine'},
    '95' : {'code':'93','name':'Seine St-Denis'},
    '96' : {'code':'94','name':'Val de Marne'},
    '97' : {'code':'95','name':'Val d\'oise'}
  },
  'GF':{
    '1' : {'code':'AWA','name':'Awala-Yalimapo'},
    '2' : {'code':'MAN','name':'Mana'},
    '3' : {'code':'SAI','name':'Saint-Laurent-Du-Maroni'},
    '4' : {'code':'APA','name':'Apatou'},
    '5' : {'code':'GRA','name':'Grand-Santi'},
    '6' : {'code':'PAP','name':'Papaïchton'},
    '7' : {'code':'SAÜ','name':'SaÜl'},
    '8' : {'code':'MAR','name':'Maripasoula'},
    '9' : {'code':'CAM','name':'Camopi'},
    '10' : {'code':'SAI','name':'Saint-Georges'},
    '11' : {'code':'OUA','name':'Ouanary'},
    '12' : {'code':'RéG','name':'Régina'},
    '13' : {'code':'ROU','name':'Roura'},
    '14' : {'code':'SAI','name':'Saint-élie'},
    '15' : {'code':'IRA','name':'Iracoubo'},
    '16' : {'code':'SIN','name':'Sinnamary'},
    '17' : {'code':'KOU','name':'Kourou'},
    '18' : {'code':'MAC','name':'Macouria'},
    '19' : {'code':'MON','name':'Montsinéry-Tonnegrande'},
    '20' : {'code':'MAT','name':'Matoury'},
    '21' : {'code':'CAY','name':'Cayenne'},
    '22' : {'code':'REM','name':'Remire-Montjoly'}
  },
  'PF':{
    '1' : {'code':'M','name':'Archipel des Marquises'},
    '2' : {'code':'T','name':'Archipel des Tuamotu'},
    '3' : {'code':'I','name':'Archipel des Tubuai'},
    '4' : {'code':'V','name':'Iles du Vent'},
    '5' : {'code':'S','name':'Iles Sous-le-Vent'}
  },
  'TF':{
    '1' : {'code':'C','name':'Iles Crozet'},
    '2' : {'code':'K','name':'Iles Kerguelen'},
    '3' : {'code':'A','name':'Ile Amsterdam'},
    '4' : {'code':'P','name':'Ile Saint-Paul'},
    '5' : {'code':'D','name':'Adelie Land'}
  },
  'GA':{
    '1' : {'code':'ES','name':'Estuaire'},
    '2' : {'code':'HO','name':'Haut-Ogooue'},
    '3' : {'code':'MO','name':'Moyen-Ogooue'},
    '4' : {'code':'NG','name':'Ngounie'},
    '5' : {'code':'NY','name':'Nyanga'},
    '6' : {'code':'OI','name':'Ogooue-Ivindo'},
    '7' : {'code':'OL','name':'Ogooue-Lolo'},
    '8' : {'code':'OM','name':'Ogooue-Maritime'},
    '9' : {'code':'WN','name':'Woleu-Ntem'}
  },
  'GM':{
    '1' : {'code':'BJ','name':'Banjul'},
    '2' : {'code':'BS','name':'Basse'},
    '3' : {'code':'BR','name':'Brikama'},
    '4' : {'code':'JA','name':'Janjangbure'},
    '5' : {'code':'KA','name':'Kanifeng'},
    '6' : {'code':'KE','name':'Kerewan'},
    '7' : {'code':'KU','name':'Kuntaur'},
    '8' : {'code':'MA','name':'Mansakonko'},
    '9' : {'code':'LR','name':'Lower River'},
    '10' : {'code':'CR','name':'Central River'},
    '11' : {'code':'NB','name':'North Bank'},
    '12' : {'code':'UR','name':'Upper River'},
    '13' : {'code':'WE','name':'Western'}
  },
  'GE':{
    '1' : {'code':'AB','name':'Abkhazia'},
    '2' : {'code':'AJ','name':'Ajaria'},
    '3' : {'code':'GU','name':'Guria'},
    '4' : {'code':'IM','name':'Imereti'},
    '5' : {'code':'KA','name':'Kakheti'},
    '6' : {'code':'KK','name':'Kvemo Kartli'},
    '7' : {'code':'MM','name':'Mtskheta-Mtianeti'},
    '8' : {'code':'RL','name':'Racha Lechkhumi and Kvemo Svanet'},
    '9' : {'code':'SJ','name':'Samtskhe-Javakheti'},
    '10' : {'code':'SK','name':'Shida Kartli'},
    '11' : {'code':'SZ','name':'Samegrelo-Zemo Svaneti'},
    '12' : {'code':'TB','name':'Tbilisi'}
  },
  'DE':{
    '1' : {'code':'BAW','name':'Baden-Württemberg'},
    '2' : {'code':'BAY','name':'Bayern'},
    '3' : {'code':'BER','name':'Berlin'},
    '4' : {'code':'BRG','name':'Brandenburg'},
    '5' : {'code':'BRE','name':'Bremen'},
    '6' : {'code':'HAM','name':'Hamburg'},
    '7' : {'code':'HES','name':'Hessen'},
    '8' : {'code':'MEC','name':'Mecklenburg-Vorpommern'},
    '9' : {'code':'NDS','name':'Niedersachsen'},
    '10' : {'code':'NRW','name':'Nordrhein-Westfalen'},
    '11' : {'code':'RHE','name':'Rheinland-Pfalz'},
    '12' : {'code':'SAR','name':'Saarland'},
    '13' : {'code':'SAS','name':'Sachsen'},
    '14' : {'code':'SAC','name':'Sachsen-Anhalt'},
    '15' : {'code':'SCN','name':'Schleswig-Holstein'},
    '16' : {'code':'THE','name':'Thüringen'}
  },
  'GH':{
    '1' : {'code':'AS','name':'Ashanti Region'},
    '2' : {'code':'BA','name':'Brong-Ahafo Region'},
    '3' : {'code':'CE','name':'Central Region'},
    '4' : {'code':'EA','name':'Eastern Region'},
    '5' : {'code':'GA','name':'Greater Accra Region'},
    '6' : {'code':'NO','name':'Northern Region'},
    '7' : {'code':'UE','name':'Upper East Region'},
    '8' : {'code':'UW','name':'Upper West Region'},
    '9' : {'code':'VO','name':'Volta Region'},
    '10' : {'code':'WE','name':'Western Region'}
  },
  'GI':{
    '1' : {'code':'EAS','name':'East Side'},
    '2' : {'code':'NOR','name':'North District'},
    '3' : {'code':'REC','name':'Reclamation Areas'},
    '4' : {'code':'SAN','name':'Sandpits Area'},
    '5' : {'code':'SOU','name':'South District'},
    '6' : {'code':'TOW','name':'Town Area'},
    '7' : {'code':'UPP','name':'Upper Town'},
    '8' : {'code':'OTH','name':'Other'}
  },
  'GR':{
    '1' : {'code':'AT','name':'Attica'},
    '2' : {'code':'CN','name':'Central Greece'},
    '3' : {'code':'CM','name':'Central Macedonia'},
    '4' : {'code':'CR','name':'Crete'},
    '5' : {'code':'EM','name':'East Macedonia and Thrace'},
    '6' : {'code':'EP','name':'Epirus'},
    '7' : {'code':'II','name':'Ionian Islands'},
    '8' : {'code':'NA','name':'North Aegean'},
    '9' : {'code':'PP','name':'Peloponnesos'},
    '10' : {'code':'SA','name':'South Aegean'},
    '11' : {'code':'TH','name':'Thessaly'},
    '12' : {'code':'WG','name':'West Greece'},
    '13' : {'code':'WM','name':'West Macedonia'}
  },
  'GL':{
    '1' : {'code':'A','name':'Avannaa'},
    '2' : {'code':'T','name':'Tunu'},
    '3' : {'code':'K','name':'Kitaa'}
  },
  '86':{
    '1' : {'code':'A','name':'Saint Andrew'},
    '2' : {'code':'D','name':'Saint David'},
    '3' : {'code':'G','name':'Saint George'},
    '4' : {'code':'J','name':'Saint John'},
    '5' : {'code':'M','name':'Saint Mark'},
    '6' : {'code':'P','name':'Saint Patrick'},
    '7' : {'code':'C','name':'Carriacou'},
    '8' : {'code':'Q','name':'Petit Martinique'}
  },
  'GP':{
    '1' : {'code':'ARR','name':'Arrondissements Of The Guadeloup'},
    '2' : {'code':'CAN','name':'Cantons Of The Guadeloup Depart'},
    '3' : {'code':'COM','name':'Communes Of The Guadeloup Depart'}
  },
  'GU':{
    '1' : {'code':'AGA','name':'Agana Heights'},
    '2' : {'code':'AGA','name':'Agat'},
    '3' : {'code':'ASA','name':'Asan Maina'},
    '4' : {'code':'BAR','name':'Barrigada'},
    '5' : {'code':'CHA','name':'Chalan Pago Ordot'},
    '6' : {'code':'DED','name':'Dededo'},
    '7' : {'code':'HAG','name':'HagÅtña'},
    '8' : {'code':'INA','name':'Inarajan'},
    '9' : {'code':'MAN','name':'Mangilao'},
    '10' : {'code':'MER','name':'Merizo'},
    '11' : {'code':'MON','name':'Mongmong Toto Maite'},
    '12' : {'code':'PIT','name':'Piti'},
    '13' : {'code':'SAN','name':'Santa Rita'},
    '14' : {'code':'SIN','name':'Sinajana'},
    '15' : {'code':'TAL','name':'Talofofo'},
    '16' : {'code':'TAM','name':'Tamuning'},
    '17' : {'code':'UMA','name':'Umatac'},
    '18' : {'code':'YIG','name':'Yigo'},
    '19' : {'code':'YON','name':'Yona'}
  },
  'GT':{
    '1' : {'code':'AV','name':'Alta Verapaz'},
    '2' : {'code':'BV','name':'Baja Verapaz'},
    '3' : {'code':'CM','name':'Chimaltenango'},
    '4' : {'code':'CQ','name':'Chiquimula'},
    '5' : {'code':'PE','name':'El Peten'},
    '6' : {'code':'PR','name':'El Progreso'},
    '7' : {'code':'QC','name':'El Quiche'},
    '8' : {'code':'ES','name':'Escuintla'},
    '9' : {'code':'GU','name':'Guatemala'},
    '10' : {'code':'HU','name':'Huehuetenango'},
    '11' : {'code':'IZ','name':'Izabal'},
    '12' : {'code':'JA','name':'Jalapa'},
    '13' : {'code':'JU','name':'Jutiapa'},
    '14' : {'code':'QZ','name':'Quetzaltenango'},
    '15' : {'code':'RE','name':'Retalhuleu'},
    '16' : {'code':'ST','name':'Sacatepequez'},
    '17' : {'code':'SM','name':'San Marcos'},
    '18' : {'code':'SR','name':'Santa Rosa'},
    '19' : {'code':'SO','name':'Solola'},
    '20' : {'code':'SU','name':'Suchitepequez'},
    '21' : {'code':'TO','name':'Totonicapan'},
    '22' : {'code':'ZA','name':'Zacapa'}
  },
  'GN':{
    '1' : {'code':'CNK','name':'Conakry'},
    '2' : {'code':'BYL','name':'Beyla'},
    '3' : {'code':'BFA','name':'Boffa'},
    '4' : {'code':'BOK','name':'Boke'},
    '5' : {'code':'COY','name':'Coyah'},
    '6' : {'code':'DBL','name':'Dabola'},
    '7' : {'code':'DLB','name':'Dalaba'},
    '8' : {'code':'DGR','name':'Dinguiraye'},
    '9' : {'code':'DBR','name':'Dubreka'},
    '10' : {'code':'FRN','name':'Faranah'},
    '11' : {'code':'FRC','name':'Forecariah'},
    '12' : {'code':'FRI','name':'Fria'},
    '13' : {'code':'GAO','name':'Gaoual'},
    '14' : {'code':'GCD','name':'Gueckedou'},
    '15' : {'code':'KNK','name':'Kankan'},
    '16' : {'code':'KRN','name':'Kerouane'},
    '17' : {'code':'KND','name':'Kindia'},
    '18' : {'code':'KSD','name':'Kissidougou'},
    '19' : {'code':'KBA','name':'Koubia'},
    '20' : {'code':'KDA','name':'Koundara'},
    '21' : {'code':'KRA','name':'Kouroussa'},
    '22' : {'code':'LAB','name':'Labe'},
    '23' : {'code':'LLM','name':'Lelouma'},
    '24' : {'code':'LOL','name':'Lola'},
    '25' : {'code':'MCT','name':'Macenta'},
    '26' : {'code':'MAL','name':'Mali'},
    '27' : {'code':'MAM','name':'Mamou'},
    '28' : {'code':'MAN','name':'Mandiana'},
    '29' : {'code':'NZR','name':'Nzerekore'},
    '30' : {'code':'PIT','name':'Pita'},
    '31' : {'code':'SIG','name':'Siguiri'},
    '32' : {'code':'TLM','name':'Telimele'},
    '33' : {'code':'TOG','name':'Tougue'},
    '34' : {'code':'YOM','name':'Yomou'}
  },
  'GW':{
    '1' : {'code':'BF','name':'Bafata Region'},
    '2' : {'code':'BB','name':'Biombo Region'},
    '3' : {'code':'BS','name':'Bissau Region'},
    '4' : {'code':'BL','name':'Bolama Region'},
    '5' : {'code':'CA','name':'Cacheu Region'},
    '6' : {'code':'GA','name':'Gabu Region'},
    '7' : {'code':'OI','name':'Oio Region'},
    '8' : {'code':'QU','name':'Quinara Region'},
    '9' : {'code':'TO','name':'Tombali Region'}
  },
  'GY':{
    '1' : {'code':'BW','name':'Barima-Waini'},
    '2' : {'code':'CM','name':'Cuyuni-Mazaruni'},
    '3' : {'code':'DM','name':'Demerara-Mahaica'},
    '4' : {'code':'EC','name':'East Berbice-Corentyne'},
    '5' : {'code':'EW','name':'Essequibo Islands-West Demerara'},
    '6' : {'code':'MB','name':'Mahaica-Berbice'},
    '7' : {'code':'PM','name':'Pomeroon-Supenaam'},
    '8' : {'code':'PI','name':'Potaro-Siparuni'},
    '9' : {'code':'UD','name':'Upper Demerara-Berbice'},
    '10' : {'code':'UT','name':'Upper Takutu-Upper Essequibo'}
  },
  'HT':{
    '1' : {'code':'AR','name':'Artibonite'},
    '2' : {'code':'CE','name':'Centre'},
    '3' : {'code':'GA','name':'Grand\'Anse'},
    '4' : {'code':'ND','name':'Nord'},
    '5' : {'code':'NE','name':'Nord-Est'},
    '6' : {'code':'NO','name':'Nord-Ouest'},
    '7' : {'code':'OU','name':'Ouest'},
    '8' : {'code':'SD','name':'Sud'},
    '9' : {'code':'SE','name':'Sud-Est'}
  },
  'HM':{
    '1' : {'code':'F','name':'Flat Island'},
    '2' : {'code':'M','name':'McDonald Island'},
    '3' : {'code':'S','name':'Shag Island'},
    '4' : {'code':'H','name':'Heard Island'}
  },
  'HN':{
    '1' : {'code':'AT','name':'Atlantida'},
    '2' : {'code':'CH','name':'Choluteca'},
    '3' : {'code':'CL','name':'Colon'},
    '4' : {'code':'CM','name':'Comayagua'},
    '5' : {'code':'CP','name':'Copan'},
    '6' : {'code':'CR','name':'Cortes'},
    '7' : {'code':'PA','name':'El Paraiso'},
    '8' : {'code':'FM','name':'Francisco Morazan'},
    '9' : {'code':'GD','name':'Gracias a Dios'},
    '10' : {'code':'IN','name':'Intibuca'},
    '11' : {'code':'IB','name':'Islas de la Bahia (Bay Islands)'},
    '12' : {'code':'PZ','name':'La Paz'},
    '13' : {'code':'LE','name':'Lempira'},
    '14' : {'code':'OC','name':'Ocotepeque'},
    '15' : {'code':'OL','name':'Olancho'},
    '16' : {'code':'SB','name':'Santa Barbara'},
    '17' : {'code':'VA','name':'Valle'},
    '18' : {'code':'YO','name':'Yoro'}
  },
  'HK':{
    '1' : {'code':'HCW','name':'Central and Western Hong Kong Is'},
    '2' : {'code':'HEA','name':'Eastern Hong Kong Island'},
    '3' : {'code':'HSO','name':'Southern Hong Kong Island'},
    '4' : {'code':'HWC','name':'Wan Chai Hong Kong Island'},
    '5' : {'code':'KKC','name':'Kowloon City Kowloon'},
    '6' : {'code':'KKT','name':'Kwun Tong Kowloon'},
    '7' : {'code':'KSS','name':'Sham Shui Po Kowloon'},
    '8' : {'code':'KWT','name':'Wong Tai Sin Kowloon'},
    '9' : {'code':'KYT','name':'Yau Tsim Mong Kowloon'},
    '10' : {'code':'NIS','name':'Islands New Territories'},
    '11' : {'code':'NKT','name':'Kwai Tsing New Territories'},
    '12' : {'code':'NNO','name':'North New Territories'},
    '13' : {'code':'NSK','name':'Sai Kung New Territories'},
    '14' : {'code':'NST','name':'Sha Tin New Territories'},
    '15' : {'code':'NTP','name':'Tai Po New Territories'},
    '16' : {'code':'NTW','name':'Tsuen Wan New Territories'},
    '17' : {'code':'NTM','name':'Tuen Mun New Territories'},
    '18' : {'code':'NYL','name':'Yuen Long New Territories'}
  },
  'HU':{
    '1' : {'code':'BK','name':'Bacs-Kiskun'},
    '2' : {'code':'BA','name':'Baranya'},
    '3' : {'code':'BE','name':'Bekes'},
    '4' : {'code':'BS','name':'Bekescsaba'},
    '5' : {'code':'BZ','name':'Borsod-Abauj-Zemplen'},
    '6' : {'code':'BU','name':'Budapest'},
    '7' : {'code':'CS','name':'Csongrad'},
    '8' : {'code':'DE','name':'Debrecen'},
    '9' : {'code':'DU','name':'Dunaujvaros'},
    '10' : {'code':'EG','name':'Eger'},
    '11' : {'code':'FE','name':'Fejer'},
    '12' : {'code':'GY','name':'Gyor'},
    '13' : {'code':'GM','name':'Gyor-Moson-Sopron'},
    '14' : {'code':'HB','name':'Hajdu-Bihar'},
    '15' : {'code':'HE','name':'Heves'},
    '16' : {'code':'HO','name':'Hodmezovasarhely'},
    '17' : {'code':'JN','name':'Jasz-Nagykun-Szolnok'},
    '18' : {'code':'KA','name':'Kaposvar'},
    '19' : {'code':'KE','name':'Kecskemet'},
    '20' : {'code':'KO','name':'Komarom-Esztergom'},
    '21' : {'code':'MI','name':'Miskolc'},
    '22' : {'code':'NA','name':'Nagykanizsa'},
    '23' : {'code':'NO','name':'Nograd'},
    '24' : {'code':'NY','name':'Nyiregyhaza'},
    '25' : {'code':'PE','name':'Pecs'},
    '26' : {'code':'PS','name':'Pest'},
    '27' : {'code':'SO','name':'Somogy'},
    '28' : {'code':'SP','name':'Sopron'},
    '29' : {'code':'SS','name':'Szabolcs-Szatmar-Bereg'},
    '30' : {'code':'SZ','name':'Szeged'},
    '31' : {'code':'SE','name':'Szekesfehervar'},
    '32' : {'code':'SL','name':'Szolnok'},
    '33' : {'code':'SM','name':'Szombathely'},
    '34' : {'code':'TA','name':'Tatabanya'},
    '35' : {'code':'TO','name':'Tolna'},
    '36' : {'code':'VA','name':'Vas'},
    '37' : {'code':'VE','name':'Veszprem'},
    '38' : {'code':'ZA','name':'Zala'},
    '39' : {'code':'ZZ','name':'Zalaegerszeg'}
  },
  'IS':{
    '1' : {'code':'AL','name':'Austurland'},
    '2' : {'code':'HF','name':'Hofuoborgarsvaeoi'},
    '3' : {'code':'NE','name':'Norourland eystra'},
    '4' : {'code':'NV','name':'Norourland vestra'},
    '5' : {'code':'SL','name':'Suourland'},
    '6' : {'code':'SN','name':'Suournes'},
    '7' : {'code':'VF','name':'Vestfiroir'},
    '8' : {'code':'VL','name':'Vesturland'}
  },
  'IN':{
    '1' : {'code':'AN','name':'Andaman and Nicobar Islands'},
    '2' : {'code':'AP','name':'Andhra Pradesh'},
    '3' : {'code':'AR','name':'Arunachal Pradesh'},
    '4' : {'code':'AS','name':'Assam'},
    '5' : {'code':'BI','name':'Bihar'},
    '6' : {'code':'CH','name':'Chandigarh'},
    '7' : {'code':'DA','name':'Dadra and Nagar Haveli'},
    '8' : {'code':'DM','name':'Daman and Diu'},
    '9' : {'code':'DE','name':'Delhi'},
    '10' : {'code':'GO','name':'Goa'},
    '11' : {'code':'GU','name':'Gujarat'},
    '12' : {'code':'HA','name':'Haryana'},
    '13' : {'code':'HP','name':'Himachal Pradesh'},
    '14' : {'code':'JA','name':'Jammu and Kashmir'},
    '15' : {'code':'KA','name':'Karnataka'},
    '16' : {'code':'KE','name':'Kerala'},
    '17' : {'code':'LI','name':'Lakshadweep Islands'},
    '18' : {'code':'MP','name':'Madhya Pradesh'},
    '19' : {'code':'MA','name':'Maharashtra'},
    '20' : {'code':'MN','name':'Manipur'},
    '21' : {'code':'ME','name':'Meghalaya'},
    '22' : {'code':'MI','name':'Mizoram'},
    '23' : {'code':'NA','name':'Nagaland'},
    '24' : {'code':'OR','name':'Orissa'},
    '25' : {'code':'PO','name':'Pondicherry'},
    '26' : {'code':'PU','name':'Punjab'},
    '27' : {'code':'RA','name':'Rajasthan'},
    '28' : {'code':'SI','name':'Sikkim'},
    '29' : {'code':'TN','name':'Tamil Nadu'},
    '30' : {'code':'TR','name':'Tripura'},
    '31' : {'code':'UP','name':'Uttar Pradesh'},
    '32' : {'code':'WB','name':'West Bengal'}
  },
  'ID':{
    '1' : {'code':'DA','name':'Daista Aceh'},
    '2' : {'code':'SU','name':'Sumatera Utara'},
    '3' : {'code':'SB','name':'Sumatera Barat'},
    '4' : {'code':'SI','name':'Riau'},
    '5' : {'code':'JA','name':'Jambi'},
    '6' : {'code':'SS','name':'Sumatera Selatan'},
    '7' : {'code':'BE','name':'Bengkulu'},
    '8' : {'code':'LA','name':'Lampung'},
    '9' : {'code':'JK','name':'Dki Jakarta'},
    '10' : {'code':'JB','name':'Jawa Barat'},
    '11' : {'code':'JT','name':'Jawa Tengah'},
    '12' : {'code':'DY','name':'Daista Yogyakarta'},
    '13' : {'code':'JT','name':'Jawa Timur'},
    '14' : {'code':'KB','name':'Kalimantan Barat'},
    '15' : {'code':'KT','name':'Kalimantan Tengah'},
    '16' : {'code':'KI','name':'Kalimantan Timur'},
    '17' : {'code':'KS','name':'Kalimantan Selatan'},
    '18' : {'code':'BA','name':'Bali'},
    '19' : {'code':'NB','name':'Nusa Tenggara Barat'},
    '20' : {'code':'NT','name':'Nusa Tenggara Timur'},
    '21' : {'code':'SN','name':'Sulawesi Selatan'},
    '22' : {'code':'ST','name':'Sulawesi Tengah'},
    '23' : {'code':'SA','name':'Sulawesi Utara'},
    '24' : {'code':'SG','name':'Sulawesi Tenggara'},
    '25' : {'code':'MA','name':'Maluku'},
    '26' : {'code':'MU','name':'Maluku Utara'},
    '27' : {'code':'IJ','name':'Irian Jaya Timur'},
    '28' : {'code':'IT','name':'Irian Jaya Tengah'},
    '29' : {'code':'IB','name':'Irian Jawa Barat'},
    '30' : {'code':'BT','name':'Banten'},
    '31' : {'code':'BB','name':'Bangka Belitung'},
    '32' : {'code':'GO','name':'Gorontalo'}
  },
  'IR':{
    '1' : {'code':'ARD','name':'Ardabil'},
    '2' : {'code':'BSH','name':'Bushehr'},
    '3' : {'code':'CMB','name':'Chahar Mahaal and Bakhtiari'},
    '4' : {'code':'EAZ','name':'East Azarbaijan'},
    '5' : {'code':'EFH','name':'Esfahan'},
    '6' : {'code':'FAR','name':'Fars'},
    '7' : {'code':'GIL','name':'Gilan'},
    '8' : {'code':'GLS','name':'Golestan'},
    '9' : {'code':'HMD','name':'Hamadan'},
    '10' : {'code':'HRM','name':'Hormozgan'},
    '11' : {'code':'ILM','name':'Ilam'},
    '12' : {'code':'KBA','name':'Kohkiluyeh and Buyer Ahmad'},
    '13' : {'code':'KRB','name':'Kerman'},
    '14' : {'code':'KRD','name':'Kurdistan'},
    '15' : {'code':'KRM','name':'Kermanshah'},
    '16' : {'code':'KZT','name':'Khuzestan'},
    '17' : {'code':'LRS','name':'Lorestan'},
    '18' : {'code':'MKZ','name':'Markazi'},
    '19' : {'code':'MZD','name':'Mazandaran'},
    '20' : {'code':'NKH','name':'North Khorasan'},
    '21' : {'code':'QAZ','name':'Qazvin'},
    '22' : {'code':'QOM','name':'Qom'},
    '23' : {'code':'RKH','name':'Razavi Khorasan'},
    '24' : {'code':'SBL','name':'Sistan and Baluchistan'},
    '25' : {'code':'SKH','name':'South Khorasan'},
    '26' : {'code':'SMN','name':'Semnan'},
    '27' : {'code':'TEH','name':'Tehran'},
    '28' : {'code':'WEZ','name':'West Azarbaijan'},
    '29' : {'code':'YZD','name':'Yazd'},
    '30' : {'code':'ZAN','name':'Zanjan'}
  },
  'IQ':{
    '1' : {'code':'AB','name':'Al Anbar'},
    '2' : {'code':'AL','name':'Arbil'},
    '3' : {'code':'BA','name':'Al Basrah'},
    '4' : {'code':'BB','name':'Babil'},
    '5' : {'code':'BD','name':'Baghdad'},
    '6' : {'code':'DH','name':'Dahuk'},
    '7' : {'code':'DQ','name':'Dhi Qar'},
    '8' : {'code':'DY','name':'Diyala'},
    '9' : {'code':'KB','name':'Al Karbala'},
    '10' : {'code':'MU','name':'Al Muthanna'},
    '11' : {'code':'MY','name':'Maysan'},
    '12' : {'code':'NJ','name':'An Najaf'},
    '13' : {'code':'NN','name':'Ninawa'},
    '14' : {'code':'QA','name':'Al Qadisyah'},
    '15' : {'code':'SD','name':'Salah ad Din'},
    '16' : {'code':'SL','name':'As Sulaymaniyah'},
    '17' : {'code':'TM','name':'At Ta\'mim'},
    '18' : {'code':'WS','name':'Wasit'}
  },
  'IE':{
    '1' : {'code':'CA','name':'Carlow'},
    '2' : {'code':'CV','name':'Cavan'},
    '3' : {'code':'CL','name':'Clare'},
    '4' : {'code':'CO','name':'Cork'},
    '5' : {'code':'DO','name':'Donegal'},
    '6' : {'code':'DU','name':'Dublin'},
    '7' : {'code':'GA','name':'Galway'},
    '8' : {'code':'KE','name':'Kerry'},
    '9' : {'code':'KI','name':'Kildare'},
    '10' : {'code':'KL','name':'Kilkenny'},
    '11' : {'code':'LA','name':'Laois'},
    '12' : {'code':'LE','name':'Leitrim'},
    '13' : {'code':'LI','name':'Limerick'},
    '14' : {'code':'LO','name':'Longford'},
    '15' : {'code':'LU','name':'Louth'},
    '16' : {'code':'MA','name':'Mayo'},
    '17' : {'code':'ME','name':'Meath'},
    '18' : {'code':'MO','name':'Monaghan'},
    '19' : {'code':'OF','name':'Offaly'},
    '20' : {'code':'RO','name':'Roscommon'},
    '21' : {'code':'SL','name':'Sligo'},
    '22' : {'code':'TI','name':'Tipperary'},
    '23' : {'code':'WA','name':'Waterford'},
    '24' : {'code':'WE','name':'Westmeath'},
    '25' : {'code':'WX','name':'Wexford'},
    '26' : {'code':'WI','name':'Wicklow'}
  },
  'IL':{
    '1' : {'code':'BS','name':'Be\'er Sheva'},
    '2' : {'code':'BH','name':'Bika\'at Hayarden'},
    '3' : {'code':'EA','name':'Eilat and Arava'},
    '4' : {'code':'GA','name':'Galil'},
    '5' : {'code':'HA','name':'Haifa'},
    '6' : {'code':'JM','name':'Jehuda Mountains'},
    '7' : {'code':'JE','name':'Jerusalem'},
    '8' : {'code':'NE','name':'Negev'},
    '10' : {'code':'SE','name':'Semaria'},
    '11' : {'code':'SH','name':'Sharon'},
    '12' : {'code':'TA','name':'Tel Aviv (Gosh Dan)'}
  },
  'IT':{
    '1' : {'code':'AG','name':'Agrigento'},
    '2' : {'code':'AL','name':'Alessandria'},
    '3' : {'code':'AN','name':'Ancona'},
    '4' : {'code':'AO','name':'Aosta'},
    '5' : {'code':'AR','name':'Arezzo'},
    '6' : {'code':'AP','name':'Ascoli Piceno'},
    '7' : {'code':'AT','name':'Asti'},
    '8' : {'code':'AV','name':'Avellino'},
    '9' : {'code':'BA','name':'Bari'},
    '10' : {'code':'BL','name':'Belluno'},
    '11' : {'code':'BN','name':'Benevento'},
    '12' : {'code':'BG','name':'Bergamo'},
    '13' : {'code':'BI','name':'Biella'},
    '14' : {'code':'BO','name':'Bologna'},
    '15' : {'code':'BZ','name':'Bolzano'},
    '16' : {'code':'BS','name':'Brescia'},
    '17' : {'code':'BR','name':'Brindisi'},
    '18' : {'code':'CA','name':'Cagliari'},
    '19' : {'code':'CL','name':'Caltanissetta'},
    '20' : {'code':'CB','name':'Campobasso'},
    '21' : {'code':'CE','name':'Caserta'},
    '22' : {'code':'CT','name':'Catania'},
    '23' : {'code':'CZ','name':'Catanzaro'},
    '24' : {'code':'CH','name':'Chieti'},
    '25' : {'code':'CO','name':'Como'},
    '26' : {'code':'CS','name':'Cosenza'},
    '27' : {'code':'CR','name':'Cremona'},
    '28' : {'code':'KR','name':'Crotone'},
    '29' : {'code':'CN','name':'Cuneo'},
    '30' : {'code':'EN','name':'Enna'},
    '31' : {'code':'FE','name':'Ferrara'},
    '32' : {'code':'FI','name':'Firenze'},
    '33' : {'code':'FG','name':'Foggia'},
    '34' : {'code':'FO','name':'Forlì'},
    '35' : {'code':'FR','name':'Frosinone'},
    '36' : {'code':'GE','name':'Genova'},
    '37' : {'code':'GO','name':'Gorizia'},
    '38' : {'code':'GR','name':'Grosseto'},
    '39' : {'code':'IM','name':'Imperia'},
    '40' : {'code':'IS','name':'Isernia'},
    '41' : {'code':'AQ','name':'Aquila'},
    '42' : {'code':'SP','name':'La Spezia'},
    '43' : {'code':'LT','name':'Latina'},
    '44' : {'code':'LE','name':'Lecce'},
    '45' : {'code':'LC','name':'Lecco'},
    '46' : {'code':'LI','name':'Livorno'},
    '47' : {'code':'LO','name':'Lodi'},
    '48' : {'code':'LU','name':'Lucca'},
    '49' : {'code':'MC','name':'Macerata'},
    '50' : {'code':'MN','name':'Mantova'},
    '51' : {'code':'MS','name':'Massa-Carrara'},
    '52' : {'code':'MT','name':'Matera'},
    '53' : {'code':'ME','name':'Messina'},
    '54' : {'code':'MI','name':'Milano'},
    '55' : {'code':'MO','name':'Modena'},
    '56' : {'code':'NA','name':'Napoli'},
    '57' : {'code':'NO','name':'Novara'},
    '58' : {'code':'NU','name':'Nuoro'},
    '59' : {'code':'OR','name':'Oristano'},
    '60' : {'code':'PD','name':'Padova'},
    '61' : {'code':'PA','name':'Palermo'},
    '62' : {'code':'PR','name':'Parma'},
    '63' : {'code':'PG','name':'Perugia'},
    '64' : {'code':'PV','name':'Pavia'},
    '65' : {'code':'PU','name':'Pesaro Urbino'},
    '66' : {'code':'PE','name':'Pescara'},
    '67' : {'code':'PC','name':'Piacenza'},
    '68' : {'code':'PI','name':'Pisa'},
    '69' : {'code':'PT','name':'Pistoia'},
    '70' : {'code':'PN','name':'Pordenone'},
    '71' : {'code':'PZ','name':'Potenza'},
    '72' : {'code':'PO','name':'Prato'},
    '73' : {'code':'RG','name':'Ragusa'},
    '74' : {'code':'RA','name':'Ravenna'},
    '75' : {'code':'RC','name':'Reggio Calabria'},
    '76' : {'code':'RE','name':'Reggio Emilia'},
    '77' : {'code':'RI','name':'Rieti'},
    '78' : {'code':'RN','name':'Rimini'},
    '79' : {'code':'RM','name':'Roma'},
    '80' : {'code':'RO','name':'Rovigo'},
    '81' : {'code':'SA','name':'Salerno'},
    '82' : {'code':'SS','name':'Sassari'},
    '83' : {'code':'SV','name':'Savona'},
    '84' : {'code':'SI','name':'Siena'},
    '85' : {'code':'SR','name':'Siracusa'},
    '86' : {'code':'SO','name':'Sondrio'},
    '87' : {'code':'TA','name':'Taranto'},
    '88' : {'code':'TE','name':'Teramo'},
    '89' : {'code':'TR','name':'Terni'},
    '90' : {'code':'TO','name':'Torino'},
    '91' : {'code':'TP','name':'Trapani'},
    '92' : {'code':'TN','name':'Trento'},
    '93' : {'code':'TV','name':'Treviso'},
    '94' : {'code':'TS','name':'Trieste'},
    '95' : {'code':'UD','name':'Udine'},
    '96' : {'code':'VA','name':'Varese'},
    '97' : {'code':'VE','name':'Venezia'},
    '98' : {'code':'VB','name':'Verbania'},
    '99' : {'code':'VC','name':'Vercelli'},
    '100' : {'code':'VR','name':'Verona'},
    '101' : {'code':'VV','name':'Vibo Valentia'},
    '102' : {'code':'VI','name':'Vicenza'},
    '103' : {'code':'VT','name':'Viterbo'},
    '104' : {'code':'CI','name':'Carbonia-Iglesias'},
    '105' : {'code':'VS','name':'Medio Campidano'},
    '106' : {'code':'OG','name':'Ogliastra'},
    '107' : {'code':'OT','name':'Olbia-Tempio'},
    '108' : {'code':'MB','name':'Monza e Brianza'},
    '109' : {'code':'FM','name':'Fermo'},
    '110' : {'code':'BT','name':'Barletta-Andria-Trani'}
  },
  'JM':{
    '1' : {'code':'CLA','name':'Clarendon Parish'},
    '2' : {'code':'HAN','name':'Hanover Parish'},
    '3' : {'code':'KIN','name':'Kingston Parish'},
    '4' : {'code':'MAN','name':'Manchester Parish'},
    '5' : {'code':'POR','name':'Portland Parish'},
    '6' : {'code':'AND','name':'Saint Andrew Parish'},
    '7' : {'code':'ANN','name':'Saint Ann Parish'},
    '8' : {'code':'CAT','name':'Saint Catherine Parish'},
    '9' : {'code':'ELI','name':'Saint Elizabeth Parish'},
    '10' : {'code':'JAM','name':'Saint James Parish'},
    '11' : {'code':'MAR','name':'Saint Mary Parish'},
    '12' : {'code':'THO','name':'Saint Thomas Parish'},
    '13' : {'code':'TRL','name':'Trelawny Parish'},
    '14' : {'code':'WML','name':'Westmoreland Parish'}
  },
  'JP':{
    '1' : {'code':'AI','name':'Aichi'},
    '2' : {'code':'AK','name':'Akita'},
    '3' : {'code':'AO','name':'Aomori'},
    '4' : {'code':'CH','name':'Chiba'},
    '5' : {'code':'EH','name':'Ehime'},
    '6' : {'code':'FK','name':'Fukui'},
    '7' : {'code':'FU','name':'Fukuoka'},
    '8' : {'code':'FS','name':'Fukushima'},
    '9' : {'code':'GI','name':'Gifu'},
    '10' : {'code':'GU','name':'Gumma'},
    '11' : {'code':'HI','name':'Hiroshima'},
    '12' : {'code':'HO','name':'Hokkaido'},
    '13' : {'code':'HY','name':'Hyogo'},
    '14' : {'code':'IB','name':'Ibaraki'},
    '15' : {'code':'IS','name':'Ishikawa'},
    '16' : {'code':'IW','name':'Iwate'},
    '17' : {'code':'KA','name':'Kagawa'},
    '18' : {'code':'KG','name':'Kagoshima'},
    '19' : {'code':'KN','name':'Kanagawa'},
    '20' : {'code':'KO','name':'Kochi'},
    '21' : {'code':'KU','name':'Kumamoto'},
    '22' : {'code':'KY','name':'Kyoto'},
    '23' : {'code':'MI','name':'Mie'},
    '24' : {'code':'MY','name':'Miyagi'},
    '25' : {'code':'MZ','name':'Miyazaki'},
    '26' : {'code':'NA','name':'Nagano'},
    '27' : {'code':'NG','name':'Nagasaki'},
    '28' : {'code':'NR','name':'Nara'},
    '29' : {'code':'NI','name':'Niigata'},
    '30' : {'code':'OI','name':'Oita'},
    '31' : {'code':'OK','name':'Okayama'},
    '32' : {'code':'ON','name':'Okinawa'},
    '33' : {'code':'OS','name':'Osaka'},
    '34' : {'code':'SA','name':'Saga'},
    '35' : {'code':'SI','name':'Saitama'},
    '36' : {'code':'SH','name':'Shiga'},
    '37' : {'code':'SM','name':'Shimane'},
    '38' : {'code':'SZ','name':'Shizuoka'},
    '39' : {'code':'TO','name':'Tochigi'},
    '40' : {'code':'TS','name':'Tokushima'},
    '41' : {'code':'TK','name':'Tokyo'},
    '42' : {'code':'TT','name':'Tottori'},
    '43' : {'code':'TY','name':'Toyama'},
    '44' : {'code':'WA','name':'Wakayama'},
    '45' : {'code':'YA','name':'Yamagata'},
    '46' : {'code':'YM','name':'Yamaguchi'},
    '47' : {'code':'YN','name':'Yamanashi'}
  },
  'JO':{
    '1' : {'code':'AM','name':'\'Amman'},
    '2' : {'code':'AJ','name':'Ajlun'},
    '3' : {'code':'AA','name':'Al\'Aqabah'},
    '4' : {'code':'AB','name':'Al Balqa\''},
    '5' : {'code':'AK','name':'Al Karak'},
    '6' : {'code':'AL','name':'Al Mafraq'},
    '7' : {'code':'AT','name':'At Tafilah'},
    '8' : {'code':'AZ','name':'Az Zarqa\''},
    '9' : {'code':'IR','name':'Irbid'},
    '10' : {'code':'JA','name':'Jarash'},
    '11' : {'code':'MA','name':'Ma\'an'},
    '12' : {'code':'MD','name':'Madaba'}
  },
  'KZ':{
    '1' : {'code':'AL','name':'Almaty'},
    '2' : {'code':'AC','name':'Almaty City'},
    '3' : {'code':'AM','name':'Aqmola'},
    '4' : {'code':'AQ','name':'Aqtobe'},
    '5' : {'code':'AS','name':'Astana City'},
    '6' : {'code':'AT','name':'Atyrau'},
    '7' : {'code':'BA','name':'Batys Qazaqstan'},
    '8' : {'code':'BY','name':'Bayqongyr City'},
    '9' : {'code':'MA','name':'Mangghystau'},
    '10' : {'code':'ON','name':'Ongtustik Qazaqstan'},
    '11' : {'code':'PA','name':'Pavlodar'},
    '12' : {'code':'QA','name':'Qaraghandy'},
    '13' : {'code':'QO','name':'Qostanay'},
    '14' : {'code':'QY','name':'Qyzylorda'},
    '15' : {'code':'SH','name':'Shyghys Qazaqstan'},
    '16' : {'code':'SO','name':'Soltustik Qazaqstan'},
    '17' : {'code':'ZH','name':'Zhambyl'}
  },
  'KE':{
    '1' : {'code':'CE','name':'Central'},
    '2' : {'code':'CO','name':'Coast'},
    '3' : {'code':'EA','name':'Eastern'},
    '4' : {'code':'NA','name':'Nairobi Area'},
    '5' : {'code':'NE','name':'North Eastern'},
    '6' : {'code':'NY','name':'Nyanza'},
    '7' : {'code':'RV','name':'Rift Valley'},
    '8' : {'code':'WE','name':'Western'}
  },
  'KI':{
    '1' : {'code':'AG','name':'Abaiang'},
    '2' : {'code':'AM','name':'Abemama'},
    '3' : {'code':'AK','name':'Aranuka'},
    '4' : {'code':'AO','name':'Arorae'},
    '5' : {'code':'BA','name':'Banaba'},
    '6' : {'code':'BE','name':'Beru'},
    '7' : {'code':'bT','name':'Butaritari'},
    '8' : {'code':'KA','name':'Kanton'},
    '9' : {'code':'KR','name':'Kiritimati'},
    '10' : {'code':'KU','name':'Kuria'},
    '11' : {'code':'MI','name':'Maiana'},
    '12' : {'code':'MN','name':'Makin'},
    '13' : {'code':'ME','name':'Marakei'},
    '14' : {'code':'NI','name':'Nikunau'},
    '15' : {'code':'NO','name':'Nonouti'},
    '16' : {'code':'ON','name':'Onotoa'},
    '17' : {'code':'TT','name':'Tabiteuea'},
    '18' : {'code':'TR','name':'Tabuaeran'},
    '19' : {'code':'TM','name':'Tamana'},
    '20' : {'code':'TW','name':'Tarawa'},
    '21' : {'code':'TE','name':'Teraina'}
  },
  'KP':{
    '1' : {'code':'CHA','name':'Chagang-do'},
    '2' : {'code':'HAB','name':'Hamgyong-bukto'},
    '3' : {'code':'HAN','name':'Hamgyong-namdo'},
    '4' : {'code':'HWB','name':'Hwanghae-bukto'},
    '5' : {'code':'HWN','name':'Hwanghae-namdo'},
    '6' : {'code':'KAN','name':'Kangwon-do'},
    '7' : {'code':'PYB','name':'P\'yongan-bukto'},
    '8' : {'code':'PYN','name':'P\'yongan-namdo'},
    '9' : {'code':'YAN','name':'Ryanggang-do (Yanggang-do)'},
    '10' : {'code':'NAJ','name':'Rason Directly Governed City'},
    '11' : {'code':'PYO','name':'P\'yongyang Special City'}
  },
  'KR':{
    '1' : {'code':'CO','name':'Ch\'ungch\'ong-bukto'},
    '2' : {'code':'CH','name':'Ch\'ungch\'ong-namdo'},
    '3' : {'code':'CD','name':'Cheju-do'},
    '4' : {'code':'CB','name':'Cholla-bukto'},
    '5' : {'code':'CN','name':'Cholla-namdo'},
    '6' : {'code':'IG','name':'Inch\'on-gwangyoksi'},
    '7' : {'code':'KA','name':'Kangwon-do'},
    '8' : {'code':'KG','name':'Kwangju-gwangyoksi'},
    '9' : {'code':'KD','name':'Kyonggi-do'},
    '10' : {'code':'KB','name':'Kyongsang-bukto'},
    '11' : {'code':'KN','name':'Kyongsang-namdo'},
    '12' : {'code':'PG','name':'Pusan-gwangyoksi'},
    '13' : {'code':'SO','name':'Soul-t\'ukpyolsi'},
    '14' : {'code':'TA','name':'Taegu-gwangyoksi'},
    '15' : {'code':'TG','name':'Taejon-gwangyoksi'}
  },
  'KW':{
    '1' : {'code':'AL','name':'Al\'Asimah'},
    '2' : {'code':'AA','name':'Al Ahmadi'},
    '3' : {'code':'AF','name':'Al Farwaniyah'},
    '4' : {'code':'AJ','name':'Al Jahra\''},
    '5' : {'code':'HA','name':'Hawalli'}
  },
  'KG':{
    '1' : {'code':'GB','name':'Bishkek'},
    '2' : {'code':'B','name':'Batken'},
    '3' : {'code':'C','name':'Chu'},
    '4' : {'code':'J','name':'Jalal-Abad'},
    '5' : {'code':'N','name':'Naryn'},
    '6' : {'code':'O','name':'Osh'},
    '7' : {'code':'T','name':'Talas'},
    '8' : {'code':'Y','name':'Ysyk-Kol'}
  },
  'LA':{
    '1' : {'code':'VT','name':'Vientiane'},
    '2' : {'code':'AT','name':'Attapu'},
    '3' : {'code':'BK','name':'Bokeo'},
    '4' : {'code':'BL','name':'Bolikhamxai'},
    '5' : {'code':'CH','name':'Champasak'},
    '6' : {'code':'HO','name':'Houaphan'},
    '7' : {'code':'KH','name':'Khammouan'},
    '8' : {'code':'LM','name':'Louang Namtha'},
    '9' : {'code':'LP','name':'Louangphabang'},
    '10' : {'code':'OU','name':'Oudomxai'},
    '11' : {'code':'PH','name':'Phongsali'},
    '12' : {'code':'SL','name':'Salavan'},
    '13' : {'code':'SV','name':'Savannakhet'},
    '14' : {'code':'VI','name':'Vientiane'},
    '15' : {'code':'XA','name':'Xaignabouli'},
    '16' : {'code':'XE','name':'Xekong'},
    '17' : {'code':'XI','name':'Xiangkhoang'},
    '18' : {'code':'XN','name':'Xaisomboun'}
  },
  'LV':{
    '1' : {'code':'AIZ','name':'Aizkraukles Rajons'},
    '2' : {'code':'ALU','name':'Aluksnes Rajons'},
    '3' : {'code':'BAL','name':'Balvu Rajons'},
    '4' : {'code':'BAU','name':'Bauskas Rajons'},
    '5' : {'code':'CES','name':'Cesu Rajons'},
    '6' : {'code':'DGR','name':'Daugavpils Rajons'},
    '7' : {'code':'DOB','name':'Dobeles Rajons'},
    '8' : {'code':'GUL','name':'Gulbenes Rajons'},
    '9' : {'code':'JEK','name':'Jekabpils Rajons'},
    '10' : {'code':'JGR','name':'Jelgavas Rajons'},
    '11' : {'code':'KRA','name':'Kraslavas Rajons'},
    '12' : {'code':'KUL','name':'Kuldigas Rajons'},
    '13' : {'code':'LPR','name':'Liepajas Rajons'},
    '14' : {'code':'LIM','name':'Limbazu Rajons'},
    '15' : {'code':'LUD','name':'Ludzas Rajons'},
    '16' : {'code':'MAD','name':'Madonas Rajons'},
    '17' : {'code':'OGR','name':'Ogres Rajons'},
    '18' : {'code':'PRE','name':'Preilu Rajons'},
    '19' : {'code':'RZR','name':'Rezeknes Rajons'},
    '20' : {'code':'RGR','name':'Rigas Rajons'},
    '21' : {'code':'SAL','name':'Saldus Rajons'},
    '22' : {'code':'TAL','name':'Talsu Rajons'},
    '23' : {'code':'TUK','name':'Tukuma Rajons'},
    '24' : {'code':'VLK','name':'Valkas Rajons'},
    '25' : {'code':'VLM','name':'Valmieras Rajons'},
    '26' : {'code':'VSR','name':'Ventspils Rajons'},
    '27' : {'code':'DGV','name':'Daugavpils'},
    '28' : {'code':'JGV','name':'Jelgava'},
    '29' : {'code':'JUR','name':'Jurmala'},
    '30' : {'code':'LPK','name':'Liepaja'},
    '31' : {'code':'RZK','name':'Rezekne'},
    '32' : {'code':'RGA','name':'Riga'},
    '33' : {'code':'VSL','name':'Ventspils'}
  },
  'LB':{
    '1' : {'code':'BIN','name':'Bint Jbeil'},
    '2' : {'code':'HAS','name':'Hasbaya'},
    '3' : {'code':'MAR','name':'Marjeyoun'},
    '4' : {'code':'NAB','name':'Nabatieh'},
    '5' : {'code':'BAA','name':'Baalbek'},
    '6' : {'code':'HER','name':'Hermel'},
    '7' : {'code':'RAS','name':'Rashaya'},
    '8' : {'code':'WES','name':'Western Beqaa'},
    '9' : {'code':'ZAH','name':'Zahle'},
    '10' : {'code':'AKK','name':'Akkar'},
    '11' : {'code':'BAT','name':'Batroun'},
    '12' : {'code':'BSH','name':'Bsharri'},
    '13' : {'code':'KOU','name':'Koura'},
    '14' : {'code':'MIN','name':'Miniyeh-Danniyeh'},
    '15' : {'code':'TRI','name':'Tripoli'},
    '16' : {'code':'ZGH','name':'Zgharta'},
    '17' : {'code':'ALE','name':'Aley'},
    '18' : {'code':'BAA','name':'Baabda'},
    '19' : {'code':'BYB','name':'Byblos'},
    '20' : {'code':'CHO','name':'Chouf'},
    '21' : {'code':'KES','name':'Kesrwan'},
    '22' : {'code':'MAT','name':'Matn'},
    '23' : {'code':'JEZ','name':'Jezzine'},
    '24' : {'code':'SID','name':'Sidon'},
    '25' : {'code':'TYR','name':'Tyre'}
  },
  'LS':{
    '1' : {'code':'BE','name':'Berea'},
    '2' : {'code':'BB','name':'Butha-Buthe'},
    '3' : {'code':'LE','name':'Leribe'},
    '4' : {'code':'MF','name':'Mafeteng'},
    '5' : {'code':'MS','name':'Maseru'},
    '6' : {'code':'MH','name':'Mohale\'s Hoek'},
    '7' : {'code':'MK','name':'Mokhotlong'},
    '8' : {'code':'QN','name':'Qacha\'s Nek'},
    '9' : {'code':'QT','name':'Quthing'},
    '10' : {'code':'TT','name':'Thaba-Tseka'}
  },
  'LR':{
    '1' : {'code':'BI','name':'Bomi'},
    '2' : {'code':'BG','name':'Bong'},
    '3' : {'code':'GB','name':'Grand Bassa'},
    '4' : {'code':'CM','name':'Grand Cape Mount'},
    '5' : {'code':'GG','name':'Grand Gedeh'},
    '6' : {'code':'GK','name':'Grand Kru'},
    '7' : {'code':'LO','name':'Lofa'},
    '8' : {'code':'MG','name':'Margibi'},
    '9' : {'code':'ML','name':'Maryland'},
    '10' : {'code':'MS','name':'Montserrado'},
    '11' : {'code':'NB','name':'Nimba'},
    '12' : {'code':'RC','name':'River Cess'},
    '13' : {'code':'SN','name':'Sinoe'}
  },
  'LY':{
    '1' : {'code':'AJ','name':'Ajdabiya'},
    '2' : {'code':'AZ','name':'Al \'Aziziyah'},
    '3' : {'code':'FA','name':'Al Fatih'},
    '4' : {'code':'JA','name':'Al Jabal al Akhdar'},
    '5' : {'code':'JU','name':'Al Jufrah'},
    '6' : {'code':'KH','name':'Al Khums'},
    '7' : {'code':'KU','name':'Al Kufrah'},
    '8' : {'code':'NK','name':'An Nuqat al Khams'},
    '9' : {'code':'AS','name':'Ash Shati\''},
    '10' : {'code':'AW','name':'Awbari'},
    '11' : {'code':'ZA','name':'Az Zawiyah'},
    '12' : {'code':'BA','name':'Banghazi'},
    '13' : {'code':'DA','name':'Darnah'},
    '14' : {'code':'GD','name':'Ghadamis'},
    '15' : {'code':'GY','name':'Gharyan'},
    '16' : {'code':'MI','name':'Misratah'},
    '17' : {'code':'MZ','name':'Murzuq'},
    '18' : {'code':'SB','name':'Sabha'},
    '19' : {'code':'SW','name':'Sawfajjin'},
    '20' : {'code':'SU','name':'Surt'},
    '21' : {'code':'TL','name':'Tarabulus (Tripoli)'},
    '22' : {'code':'TH','name':'Tarhunah'},
    '23' : {'code':'TU','name':'Tubruq'},
    '24' : {'code':'YA','name':'Yafran'},
    '25' : {'code':'ZL','name':'Zlitan'}
  },
  'LI':{
    '1' : {'code':'V','name':'Vaduz'},
    '2' : {'code':'A','name':'Schaan'},
    '3' : {'code':'B','name':'Balzers'},
    '4' : {'code':'N','name':'Triesen'},
    '5' : {'code':'E','name':'Eschen'},
    '6' : {'code':'M','name':'Mauren'},
    '7' : {'code':'T','name':'Triesenberg'},
    '8' : {'code':'R','name':'Ruggell'},
    '9' : {'code':'G','name':'Gamprin'},
    '10' : {'code':'L','name':'Schellenberg'},
    '11' : {'code':'P','name':'Planken'}
  },
  'LT':{
    '1' : {'code':'AL','name':'Alytus'},
    '2' : {'code':'KA','name':'Kaunas'},
    '3' : {'code':'KL','name':'Klaipeda'},
    '4' : {'code':'MA','name':'Marijampole'},
    '5' : {'code':'PA','name':'Panevezys'},
    '6' : {'code':'SI','name':'Siauliai'},
    '7' : {'code':'TA','name':'Taurage'},
    '8' : {'code':'TE','name':'Telsiai'},
    '9' : {'code':'UT','name':'Utena'},
    '10' : {'code':'VI','name':'Vilnius'}
  },
  'LU':{
    '1' : {'code':'DD','name':'Diekirch'},
    '2' : {'code':'DC','name':'Clervaux'},
    '3' : {'code':'DR','name':'Redange'},
    '4' : {'code':'DV','name':'Vianden'},
    '5' : {'code':'DW','name':'Wiltz'},
    '6' : {'code':'GG','name':'Grevenmacher'},
    '7' : {'code':'GE','name':'Echternach'},
    '8' : {'code':'GR','name':'Remich'},
    '9' : {'code':'LL','name':'Luxembourg'},
    '10' : {'code':'LC','name':'Capellen'},
    '11' : {'code':'LE','name':'Esch-sur-Alzette'},
    '12' : {'code':'LM','name':'Mersch'}
  },
  'MO':{
    '1' : {'code':'OLF','name':'Our Lady Fatima Parish'},
    '2' : {'code':'ANT','name':'St. Anthony Parish'},
    '3' : {'code':'LAZ','name':'St. Lazarus Parish'},
    '4' : {'code':'CAT','name':'Cathedral Parish'},
    '5' : {'code':'LAW','name':'St. Lawrence Parish'}
  },
  'MK':{
    '1' : {'code':'AER','name':'Aerodrom'},
    '2' : {'code':'ARA','name':'Aračinovo'},
    '3' : {'code':'BER','name':'Berovo'},
    '4' : {'code':'BIT','name':'Bitola'},
    '5' : {'code':'BOG','name':'Bogdanci'},
    '6' : {'code':'BOG','name':'Bogovinje'},
    '7' : {'code':'BOS','name':'Bosilovo'},
    '8' : {'code':'BRV','name':'Brvenica'},
    '9' : {'code':'BUT','name':'Butel'},
    '10' : {'code':'ČAI','name':'Čair'},
    '11' : {'code':'ČAš','name':'Čaška'},
    '12' : {'code':'CEN','name':'Centar'},
    '13' : {'code':'CEN','name':'Centar Župa'},
    '14' : {'code':'Češ','name':'Češinovo-Obleš'},
    '15' : {'code':'ČUČ','name':'Čučer-Sandevo'},
    '16' : {'code':'DEB','name':'Debar'},
    '17' : {'code':'DEB','name':'Debarca'},
    '18' : {'code':'DEL','name':'Delčevo'},
    '19' : {'code':'DEM','name':'Demir Hisar'},
    '20' : {'code':'DEM','name':'Demir Kapija'},
    '21' : {'code':'DOL','name':'Dolneni'},
    '22' : {'code':'DRU','name':'Drugovo'},
    '23' : {'code':'GAZ','name':'Gazi Baba'},
    '24' : {'code':'GEV','name':'Gevgelija'},
    '25' : {'code':'GJO','name':'Gjorče Petrov'},
    '26' : {'code':'GOS','name':'Gostivar'},
    '27' : {'code':'GRA','name':'Gradsko'},
    '28' : {'code':'ILI','name':'Ilinden'},
    '29' : {'code':'JEG','name':'Jegunovce'},
    '30' : {'code':'KAR','name':'Karbinci'},
    '31' : {'code':'KAR','name':'Karpoš'},
    '32' : {'code':'KAV','name':'Kavadarci'},
    '33' : {'code':'KIČ','name':'Kičevo'},
    '34' : {'code':'KIS','name':'Kisela Voda'},
    '35' : {'code':'KOč','name':'Kočani'},
    '36' : {'code':'KON','name':'Konče'},
    '37' : {'code':'KRA','name':'Kratovo'},
    '38' : {'code':'KRI','name':'Kriva Palanka'},
    '39' : {'code':'KRI','name':'Krivogaštani'},
    '40' : {'code':'KRU','name':'Kruševo'},
    '41' : {'code':'KUM','name':'Kumanovo'},
    '42' : {'code':'LIP','name':'Lipkovo'},
    '43' : {'code':'LOZ','name':'Lozovo'},
    '44' : {'code':'MAK','name':'Makedonska Kamenica'},
    '45' : {'code':'MAK','name':'Makedonski Brod'},
    '46' : {'code':'MAV','name':'Mavrovo and Rostuša'},
    '47' : {'code':'MOG','name':'Mogila'},
    '48' : {'code':'NEG','name':'Negotino'},
    '49' : {'code':'NOV','name':'Novaci'},
    '50' : {'code':'NOV','name':'Novo Selo'},
    '51' : {'code':'OHR','name':'Ohrid'},
    '52' : {'code':'OSL','name':'Oslomej'},
    '53' : {'code':'PEH','name':'Pehčevo'},
    '54' : {'code':'PET','name':'Petrovec'},
    '55' : {'code':'PLA','name':'Plasnica'},
    '56' : {'code':'PRI','name':'Prilep'},
    '57' : {'code':'PRO','name':'Probištip'},
    '58' : {'code':'RAD','name':'Radoviš'},
    '59' : {'code':'RAN','name':'Rankovce'},
    '60' : {'code':'RES','name':'Resen'},
    '61' : {'code':'ROS','name':'Rosoman'},
    '62' : {'code':'SAR','name':'Saraj'},
    '63' : {'code':'SOP','name':'Sopište'},
    '64' : {'code':'STA','name':'Star Dojran'},
    '65' : {'code':'STA','name':'Staro Nagoričane'},
    '66' : {'code':'ŠTI','name':'Štip'},
    '67' : {'code':'STR','name':'Struga'},
    '68' : {'code':'STR','name':'Strumica'},
    '69' : {'code':'STU','name':'Studeničani'},
    '70' : {'code':'ŠUT','name':'Šuto Orizari'},
    '71' : {'code':'SVE','name':'Sveti Nikole'},
    '72' : {'code':'TEA','name':'Tearce'},
    '73' : {'code':'TET','name':'Tetovo'},
    '74' : {'code':'VAL','name':'Valandovo'},
    '75' : {'code':'VAS','name':'Vasilevo'},
    '76' : {'code':'VEL','name':'Veles'},
    '77' : {'code':'VEV','name':'Vevčani'},
    '78' : {'code':'VIN','name':'Vinica'},
    '79' : {'code':'VRA','name':'Vraneštica'},
    '80' : {'code':'VRA','name':'Vrapčište'},
    '81' : {'code':'ZAJ','name':'Zajas'},
    '82' : {'code':'ZEL','name':'Zelenikovo'},
    '83' : {'code':'ŽEL','name':'Želino'},
    '84' : {'code':'ZRN','name':'Zrnovci'}
  },
  'MG':{
    '1' : {'code':'AN','name':'Antananarivo'},
    '2' : {'code':'AS','name':'Antsiranana'},
    '3' : {'code':'FN','name':'Fianarantsoa'},
    '4' : {'code':'MJ','name':'Mahajanga'},
    '5' : {'code':'TM','name':'Toamasina'},
    '6' : {'code':'TL','name':'Toliara'}
  },
  'MW':{
    '1' : {'code':'BLK','name':'Balaka'},
    '2' : {'code':'BLT','name':'Blantyre'},
    '3' : {'code':'CKW','name':'Chikwawa'},
    '4' : {'code':'CRD','name':'Chiradzulu'},
    '5' : {'code':'CTP','name':'Chitipa'},
    '6' : {'code':'DDZ','name':'Dedza'},
    '7' : {'code':'DWA','name':'Dowa'},
    '8' : {'code':'KRG','name':'Karonga'},
    '9' : {'code':'KSG','name':'Kasungu'},
    '10' : {'code':'LKM','name':'Likoma'},
    '11' : {'code':'LLG','name':'Lilongwe'},
    '12' : {'code':'MCG','name':'Machinga'},
    '13' : {'code':'MGC','name':'Mangochi'},
    '14' : {'code':'MCH','name':'Mchinji'},
    '15' : {'code':'MLJ','name':'Mulanje'},
    '16' : {'code':'MWZ','name':'Mwanza'},
    '17' : {'code':'MZM','name':'Mzimba'},
    '18' : {'code':'NTU','name':'Ntcheu'},
    '19' : {'code':'NKB','name':'Nkhata Bay'},
    '20' : {'code':'NKH','name':'Nkhotakota'},
    '21' : {'code':'NSJ','name':'Nsanje'},
    '22' : {'code':'NTI','name':'Ntchisi'},
    '23' : {'code':'PHL','name':'Phalombe'},
    '24' : {'code':'RMP','name':'Rumphi'},
    '25' : {'code':'SLM','name':'Salima'},
    '26' : {'code':'THY','name':'Thyolo'},
    '27' : {'code':'ZBA','name':'Zomba'}
  },
  'MY':{
    '1' : {'code':'Johor','name':'Johor'},
    '2' : {'code':'Kedah','name':'Kedah'},
    '3' : {'code':'Kelantan','name':'Kelantan'},
    '4' : {'code':'Labuan','name':'Labuan'},
    '5' : {'code':'Melaka','name':'Melaka'},
    '6' : {'code':'Negeri Sembilan','name':'Negeri Sembilan'},
    '7' : {'code':'Pahang','name':'Pahang'},
    '8' : {'code':'Perak','name':'Perak'},
    '9' : {'code':'Perlis','name':'Perlis'},
    '10' : {'code':'Pulau Pinang','name':'Pulau Pinang'},
    '11' : {'code':'Sabah','name':'Sabah'},
    '12' : {'code':'Sarawak','name':'Sarawak'},
    '13' : {'code':'Selangor','name':'Selangor'},
    '14' : {'code':'Terengganu','name':'Terengganu'},
    '15' : {'code':'Kuala Lumpur','name':'Kuala Lumpur'}
  },
  'MV':{
    '1' : {'code':'AAD','name':'Ari Atoll Dheknu'},
    '2' : {'code':'AAU','name':'Ari Atoll Uthuru'},
    '3' : {'code':'ADD','name':'Addu'},
    '4' : {'code':'FAA','name':'Faadhippolhu'},
    '5' : {'code':'FEA','name':'Felidhe Atoll'},
    '6' : {'code':'FMU','name':'Fua Mulaku'},
    '7' : {'code':'HAD','name':'Huvadhu Atoll Dhekunu'},
    '8' : {'code':'HAU','name':'Huvadhu Atoll Uthuru'},
    '9' : {'code':'HDH','name':'Hadhdhunmathi'},
    '10' : {'code':'KLH','name':'Kolhumadulu'},
    '11' : {'code':'MAA','name':'Male Atoll'},
    '12' : {'code':'MAD','name':'Maalhosmadulu Dhekunu'},
    '13' : {'code':'MAU','name':'Maalhosmadulu Uthuru'},
    '14' : {'code':'MLD','name':'Miladhunmadulu Dhekunu'},
    '15' : {'code':'MLU','name':'Miladhunmadulu Uthuru'},
    '16' : {'code':'MUA','name':'Mulaku Atoll'},
    '17' : {'code':'NAD','name':'Nilandhe Atoll Dhekunu'},
    '18' : {'code':'NAU','name':'Nilandhe Atoll Uthuru'},
    '19' : {'code':'THD','name':'Thiladhunmathi Dhekunu'},
    '20' : {'code':'THU','name':'Thiladhunmathi Uthuru'}
  },
  'ML':{
    '1' : {'code':'GA','name':'Gao'},
    '2' : {'code':'KY','name':'Kayes'},
    '3' : {'code':'KD','name':'Kidal'},
    '4' : {'code':'KL','name':'Koulikoro'},
    '5' : {'code':'MP','name':'Mopti'},
    '6' : {'code':'SG','name':'Segou'},
    '7' : {'code':'SK','name':'Sikasso'},
    '8' : {'code':'TB','name':'Tombouctou'},
    '9' : {'code':'CD','name':'Bamako Capital District'}
  },
  'MT':{
    '1' : {'code':'ATT','name':'Attard'},
    '2' : {'code':'BAL','name':'Balzan'},
    '3' : {'code':'BGU','name':'Birgu'},
    '4' : {'code':'BKK','name':'Birkirkara'},
    '5' : {'code':'BRZ','name':'Birzebbuga'},
    '6' : {'code':'BOR','name':'Bormla'},
    '7' : {'code':'DIN','name':'Dingli'},
    '8' : {'code':'FGU','name':'Fgura'},
    '9' : {'code':'FLO','name':'Floriana'},
    '10' : {'code':'GDJ','name':'Gudja'},
    '11' : {'code':'GZR','name':'Gzira'},
    '12' : {'code':'GRG','name':'Gargur'},
    '13' : {'code':'GXQ','name':'Gaxaq'},
    '14' : {'code':'HMR','name':'Hamrun'},
    '15' : {'code':'IKL','name':'Iklin'},
    '16' : {'code':'ISL','name':'Isla'},
    '17' : {'code':'KLK','name':'Kalkara'},
    '18' : {'code':'KRK','name':'Kirkop'},
    '19' : {'code':'LIJ','name':'Lija'},
    '20' : {'code':'LUQ','name':'Luqa'},
    '21' : {'code':'MRS','name':'Marsa'},
    '22' : {'code':'MKL','name':'Marsaskala'},
    '23' : {'code':'MXL','name':'Marsaxlokk'},
    '24' : {'code':'MDN','name':'Mdina'},
    '25' : {'code':'MEL','name':'Melliea'},
    '26' : {'code':'MGR','name':'Mgarr'},
    '27' : {'code':'MST','name':'Mosta'},
    '28' : {'code':'MQA','name':'Mqabba'},
    '29' : {'code':'MSI','name':'Msida'},
    '30' : {'code':'MTF','name':'Mtarfa'},
    '31' : {'code':'NAX','name':'Naxxar'},
    '32' : {'code':'PAO','name':'Paola'},
    '33' : {'code':'PEM','name':'Pembroke'},
    '34' : {'code':'PIE','name':'Pieta'},
    '35' : {'code':'QOR','name':'Qormi'},
    '36' : {'code':'QRE','name':'Qrendi'},
    '37' : {'code':'RAB','name':'Rabat'},
    '38' : {'code':'SAF','name':'Safi'},
    '39' : {'code':'SGI','name':'San Giljan'},
    '40' : {'code':'SLU','name':'Santa Lucija'},
    '41' : {'code':'SPB','name':'San Pawl il-Bahar'},
    '42' : {'code':'SGW','name':'San Gwann'},
    '43' : {'code':'SVE','name':'Santa Venera'},
    '44' : {'code':'SIG','name':'Siggiewi'},
    '45' : {'code':'SLM','name':'Sliema'},
    '46' : {'code':'SWQ','name':'Swieqi'},
    '47' : {'code':'TXB','name':'Ta Xbiex'},
    '48' : {'code':'TRX','name':'Tarxien'},
    '49' : {'code':'VLT','name':'Valletta'},
    '50' : {'code':'XGJ','name':'Xgajra'},
    '51' : {'code':'ZBR','name':'Zabbar'},
    '52' : {'code':'ZBG','name':'Zebbug'},
    '53' : {'code':'ZJT','name':'Zejtun'},
    '54' : {'code':'ZRQ','name':'Zurrieq'},
    '55' : {'code':'FNT','name':'Fontana'},
    '56' : {'code':'GHJ','name':'Ghajnsielem'},
    '57' : {'code':'GHR','name':'Gharb'},
    '58' : {'code':'GHS','name':'Ghasri'},
    '59' : {'code':'KRC','name':'Kercem'},
    '60' : {'code':'MUN','name':'Munxar'},
    '61' : {'code':'NAD','name':'Nadur'},
    '62' : {'code':'QAL','name':'Qala'},
    '63' : {'code':'VIC','name':'Victoria'},
    '64' : {'code':'SLA','name':'San Lawrenz'},
    '65' : {'code':'SNT','name':'Sannat'},
    '66' : {'code':'ZAG','name':'Xagra'},
    '67' : {'code':'XEW','name':'Xewkija'},
    '68' : {'code':'ZEB','name':'Zebbug'}
  },
  'MH':{
    '1' : {'code':'ALG','name':'Ailinginae'},
    '2' : {'code':'ALL','name':'Ailinglaplap'},
    '3' : {'code':'ALK','name':'Ailuk'},
    '4' : {'code':'ARN','name':'Arno'},
    '5' : {'code':'AUR','name':'Aur'},
    '6' : {'code':'BKR','name':'Bikar'},
    '7' : {'code':'BKN','name':'Bikini'},
    '8' : {'code':'BKK','name':'Bokak'},
    '9' : {'code':'EBN','name':'Ebon'},
    '10' : {'code':'ENT','name':'Enewetak'},
    '11' : {'code':'EKB','name':'Erikub'},
    '12' : {'code':'JBT','name':'Jabat'},
    '13' : {'code':'JLT','name':'Jaluit'},
    '14' : {'code':'JEM','name':'Jemo'},
    '15' : {'code':'KIL','name':'Kili'},
    '16' : {'code':'KWJ','name':'Kwajalein'},
    '17' : {'code':'LAE','name':'Lae'},
    '18' : {'code':'LIB','name':'Lib'},
    '19' : {'code':'LKP','name':'Likiep'},
    '20' : {'code':'MJR','name':'Majuro'},
    '21' : {'code':'MLP','name':'Maloelap'},
    '22' : {'code':'MJT','name':'Mejit'},
    '23' : {'code':'MIL','name':'Mili'},
    '24' : {'code':'NMK','name':'Namorik'},
    '25' : {'code':'NAM','name':'Namu'},
    '26' : {'code':'RGL','name':'Rongelap'},
    '27' : {'code':'RGK','name':'Rongrik'},
    '28' : {'code':'TOK','name':'Toke'},
    '29' : {'code':'UJA','name':'Ujae'},
    '30' : {'code':'UJL','name':'Ujelang'},
    '31' : {'code':'UTK','name':'Utirik'},
    '32' : {'code':'WTH','name':'Wotho'},
    '33' : {'code':'WTJ','name':'Wotje'}
  },
  'MQ':{
    '1' : {'code':'LAJ','name':'L\'Ajoupa-Bouillon'},
    '2' : {'code':'LES','name':'Les Anses-d\'Arlet'},
    '3' : {'code':'BAS','name':'Basse-Pointe'},
    '4' : {'code':'BEL','name':'Bellefontaine'},
    '5' : {'code':'LE','name':'Le Carbet'},
    '6' : {'code':'CAS','name':'Case-Pilote'},
    '7' : {'code':'LE','name':'Le Diamant'},
    '8' : {'code':'DUC','name':'Ducos'},
    '9' : {'code':'FON','name':'Fonds-Saint-Denis'},
    '10' : {'code':'FOR','name':'Fort-De-France'},
    '11' : {'code':'LE','name':'Le François'},
    '12' : {'code':'GRA','name':'Grand\'Rivière'},
    '13' : {'code':'GRO','name':'Gros-Morne'},
    '14' : {'code':'LE','name':'Le Lamentin'},
    '15' : {'code':'LE','name':'Le Lorrain'},
    '16' : {'code':'MAC','name':'Macouba'},
    '17' : {'code':'LE','name':'Le Marigot'},
    '18' : {'code':'LE','name':'Le Marin'},
    '19' : {'code':'LE','name':'Le Morne-Rouge'},
    '20' : {'code':'LE','name':'Le Morne-Vert'},
    '21' : {'code':'LE','name':'Le Prêcheur'},
    '22' : {'code':'RIV','name':'Rivière-Pilote'},
    '23' : {'code':'RIV','name':'Rivière-Salée'},
    '24' : {'code':'LE','name':'Le Robert'},
    '25' : {'code':'SAI','name':'Sainte-Anne'},
    '26' : {'code':'SAI','name':'Sainte-Luce'},
    '27' : {'code':'SAI','name':'Sainte-Marie'},
    '28' : {'code':'SAI','name':'Saint-Esprit'},
    '29' : {'code':'SAI','name':'Saint-Joseph'},
    '30' : {'code':'SAI','name':'Saint-Pierre'},
    '31' : {'code':'SCH','name':'Schœlcher'},
    '32' : {'code':'LA','name':'La Trinité'},
    '33' : {'code':'LES','name':'Les Trois-Îlets'},
    '34' : {'code':'LE','name':'Le Vauclin'}
  },
  'MR':{
    '1' : {'code':'AD','name':'Adrar'},
    '2' : {'code':'AS','name':'Assaba'},
    '3' : {'code':'BR','name':'Brakna'},
    '4' : {'code':'DN','name':'Dakhlet Nouadhibou'},
    '5' : {'code':'GO','name':'Gorgol'},
    '6' : {'code':'GM','name':'Guidimaka'},
    '7' : {'code':'HC','name':'Hodh Ech Chargui'},
    '8' : {'code':'HG','name':'Hodh El Gharbi'},
    '9' : {'code':'IN','name':'Inchiri'},
    '10' : {'code':'TA','name':'Tagant'},
    '11' : {'code':'TZ','name':'Tiris Zemmour'},
    '12' : {'code':'TR','name':'Trarza'},
    '13' : {'code':'NO','name':'Nouakchott'}
  },
  'MU':{
    '1' : {'code':'AG','name':'Agalega Islands'},
    '2' : {'code':'BL','name':'Black River'},
    '3' : {'code':'BR','name':'Beau Bassin-Rose Hill'},
    '4' : {'code':'CC','name':'Cargados Carajos Shoals (Saint B)'},
    '5' : {'code':'CU','name':'Curepipe'},
    '6' : {'code':'FL','name':'Flacq'},
    '7' : {'code':'GP','name':'Grand Port'},
    '8' : {'code':'MO','name':'Moka'},
    '9' : {'code':'PA','name':'Pamplemousses'},
    '10' : {'code':'PL','name':'Port Louis'},
    '11' : {'code':'PU','name':'Port Louis'},
    '12' : {'code':'PW','name':'Plaines Wilhems'},
    '13' : {'code':'QB','name':'Quatre Bornes'},
    '14' : {'code':'RO','name':'Rodrigues'},
    '15' : {'code':'RR','name':'Riviere du Rempart'},
    '16' : {'code':'SA','name':'Savanne'},
    '17' : {'code':'VP','name':'Vacoas-Phoenix'}
  },
  'YT':{
    '1' : {'code':'DZA','name':'Dzaoudzi'},
    '2' : {'code':'PAM','name':'Pamandzi'},
    '3' : {'code':'MAM','name':'Mamoudzou'},
    '4' : {'code':'DEM','name':'Dembeni'},
    '5' : {'code':'BAN','name':'Bandrele'},
    '6' : {'code':'KAN','name':'Kani-Kéli'},
    '7' : {'code':'BOU','name':'Bouéni'},
    '8' : {'code':'CHI','name':'Chirongui'},
    '9' : {'code':'SAD','name':'Sada'},
    '10' : {'code':'OUA','name':'Ouangani'},
    '11' : {'code':'CHI','name':'Chiconi'},
    '12' : {'code':'TSI','name':'Tsingoni'},
    '13' : {'code':'MTS','name':'M\'Tsangamouji'},
    '14' : {'code':'ACO','name':'Acoua'},
    '15' : {'code':'MTS','name':'Mtsamboro'},
    '16' : {'code':'BAN','name':'Bandraboua'},
    '17' : {'code':'KOU','name':'Koungou'}
  },
  'MX':{
    '1' : {'code':'AGU','name':'Aguascalientes'},
    '2' : {'code':'BCN','name':'Baja California Norte'},
    '3' : {'code':'BCS','name':'Baja California Sur'},
    '4' : {'code':'CAM','name':'Campeche'},
    '5' : {'code':'CHP','name':'Chiapas'},
    '6' : {'code':'CHH','name':'Chihuahua'},
    '7' : {'code':'COA','name':'Coahuila de Zaragoza'},
    '8' : {'code':'COL','name':'Colima'},
    '9' : {'code':'DIF','name':'Distrito Federal'},
    '10' : {'code':'DUR','name':'Durango'},
    '11' : {'code':'GUA','name':'Guanajuato'},
    '12' : {'code':'GRO','name':'Guerrero'},
    '13' : {'code':'HID','name':'Hidalgo'},
    '14' : {'code':'JAL','name':'Jalisco'},
    '15' : {'code':'MEX','name':'Mexico'},
    '16' : {'code':'MIC','name':'Michoacan de Ocampo'},
    '17' : {'code':'MOR','name':'Morelos'},
    '18' : {'code':'NAY','name':'Nayarit'},
    '19' : {'code':'NLE','name':'Nuevo Leon'},
    '20' : {'code':'OAX','name':'Oaxaca'},
    '21' : {'code':'PUE','name':'Puebla'},
    '22' : {'code':'QUE','name':'Queretaro de Arteaga'},
    '23' : {'code':'ROO','name':'Quintana Roo'},
    '24' : {'code':'SLP','name':'San Luis Potosi'},
    '25' : {'code':'SIN','name':'Sinaloa'},
    '26' : {'code':'SON','name':'Sonora'},
    '27' : {'code':'TAB','name':'Tabasco'},
    '28' : {'code':'TAM','name':'Tamaulipas'},
    '29' : {'code':'TLA','name':'Tlaxcala'},
    '30' : {'code':'VER','name':'Veracruz-Llave'},
    '31' : {'code':'YUC','name':'Yucatan'},
    '32' : {'code':'ZAC','name':'Zacatecas'}
  },
  'FM':{
    '1' : {'code':'C','name':'Chuuk'},
    '2' : {'code':'K','name':'Kosrae'},
    '3' : {'code':'P','name':'Pohnpei'},
    '4' : {'code':'Y','name':'Yap'}
  },
  'MD':{
    '1' : {'code':'GA','name':'Gagauzia'},
    '2' : {'code':'CU','name':'Chisinau'},
    '3' : {'code':'BA','name':'Balti'},
    '4' : {'code':'CA','name':'Cahul'},
    '5' : {'code':'ED','name':'Edinet'},
    '6' : {'code':'LA','name':'Lapusna'},
    '7' : {'code':'OR','name':'Orhei'},
    '8' : {'code':'SO','name':'Soroca'},
    '9' : {'code':'TI','name':'Tighina'},
    '10' : {'code':'UN','name':'Ungheni'},
    '11' : {'code':'SN','name':'Stânga Nistrului'}
  },
  'MC':{
    '1' : {'code':'FV','name':'Fontvieille'},
    '2' : {'code':'LC','name':'La Condamine'},
    '3' : {'code':'MV','name':'Monaco-Ville'},
    '4' : {'code':'MC','name':'Monte-Carlo'}
  },
  'MN':{
    '1' : {'code':'1','name':'Ulanbaatar'},
    '2' : {'code':'035','name':'Orhon'},
    '3' : {'code':'037','name':'Darhan uul'},
    '4' : {'code':'039','name':'Hentiy'},
    '5' : {'code':'041','name':'Hovsgol'},
    '6' : {'code':'043','name':'Hovd'},
    '7' : {'code':'046','name':'Uvs'},
    '8' : {'code':'047','name':'Tov'},
    '9' : {'code':'049','name':'Selenge'},
    '10' : {'code':'051','name':'Suhbaatar'},
    '11' : {'code':'053','name':'Omnogovi'},
    '12' : {'code':'055','name':'Ovorhangay'},
    '13' : {'code':'057','name':'Dzavhan'},
    '14' : {'code':'059','name':'DundgovL'},
    '15' : {'code':'061','name':'Dornod'},
    '16' : {'code':'063','name':'Dornogov'},
    '17' : {'code':'064','name':'Govi-Sumber'},
    '18' : {'code':'065','name':'Govi-Altay'},
    '19' : {'code':'067','name':'Bulgan'},
    '20' : {'code':'069','name':'Bayanhongor'},
    '21' : {'code':'071','name':'Bayan-Olgiy'},
    '22' : {'code':'073','name':'Arhangay'}
  },
  'MS':{
    '1' : {'code':'A','name':'Saint Anthony'},
    '2' : {'code':'G','name':'Saint Georges'},
    '3' : {'code':'P','name':'Saint Peter'}
  },
  'MA':{
    '1' : {'code':'AGD','name':'Agadir'},
    '2' : {'code':'HOC','name':'Al Hoceima'},
    '3' : {'code':'AZI','name':'Azilal'},
    '4' : {'code':'BME','name':'Beni Mellal'},
    '5' : {'code':'BSL','name':'Ben Slimane'},
    '6' : {'code':'BLM','name':'Boulemane'},
    '7' : {'code':'CBL','name':'Casablanca'},
    '8' : {'code':'CHA','name':'Chaouen'},
    '9' : {'code':'EJA','name':'El Jadida'},
    '10' : {'code':'EKS','name':'El Kelaa des Sraghna'},
    '11' : {'code':'ERA','name':'Er Rachidia'},
    '12' : {'code':'ESS','name':'Essaouira'},
    '13' : {'code':'FES','name':'Fes'},
    '14' : {'code':'FIG','name':'Figuig'},
    '15' : {'code':'GLM','name':'Guelmim'},
    '16' : {'code':'IFR','name':'Ifrane'},
    '17' : {'code':'KEN','name':'Kenitra'},
    '18' : {'code':'KHM','name':'Khemisset'},
    '19' : {'code':'KHN','name':'Khenifra'},
    '20' : {'code':'KHO','name':'Khouribga'},
    '21' : {'code':'LYN','name':'Laayoune'},
    '22' : {'code':'LAR','name':'Larache'},
    '23' : {'code':'MRK','name':'Marrakech'},
    '24' : {'code':'MKN','name':'Meknes'},
    '25' : {'code':'NAD','name':'Nador'},
    '26' : {'code':'ORZ','name':'Ouarzazate'},
    '27' : {'code':'OUJ','name':'Oujda'},
    '28' : {'code':'RSA','name':'Rabat-Sale'},
    '29' : {'code':'SAF','name':'Safi'},
    '30' : {'code':'SET','name':'Settat'},
    '31' : {'code':'SKA','name':'Sidi Kacem'},
    '32' : {'code':'TGR','name':'Tangier'},
    '33' : {'code':'TAN','name':'Tan-Tan'},
    '34' : {'code':'TAO','name':'Taounate'},
    '35' : {'code':'TRD','name':'Taroudannt'},
    '36' : {'code':'TAT','name':'Tata'},
    '37' : {'code':'TAZ','name':'Taza'},
    '38' : {'code':'TET','name':'Tetouan'},
    '39' : {'code':'TIZ','name':'Tiznit'},
    '40' : {'code':'ADK','name':'Ad Dakhla'},
    '41' : {'code':'BJD','name':'Boujdour'},
    '42' : {'code':'ESM','name':'Es Smara'}
  },
  'MZ':{
    '1' : {'code':'CD','name':'Cabo Delgado'},
    '2' : {'code':'GZ','name':'Gaza'},
    '3' : {'code':'IN','name':'Inhambane'},
    '4' : {'code':'MN','name':'Manica'},
    '5' : {'code':'MC','name':'Maputo (city)'},
    '6' : {'code':'MP','name':'Maputo'},
    '7' : {'code':'NA','name':'Nampula'},
    '8' : {'code':'NI','name':'Niassa'},
    '9' : {'code':'SO','name':'Sofala'},
    '10' : {'code':'TE','name':'Tete'},
    '11' : {'code':'ZA','name':'Zambezia'}
  },
  'MM':{
    '1' : {'code':'AY','name':'Ayeyarwady'},
    '2' : {'code':'BG','name':'Bago'},
    '3' : {'code':'MG','name':'Magway'},
    '4' : {'code':'MD','name':'Mandalay'},
    '5' : {'code':'SG','name':'Sagaing'},
    '6' : {'code':'TN','name':'Tanintharyi'},
    '7' : {'code':'YG','name':'Yangon'},
    '8' : {'code':'CH','name':'Chin State'},
    '9' : {'code':'KC','name':'Kachin State'},
    '10' : {'code':'KH','name':'Kayah State'},
    '11' : {'code':'KN','name':'Kayin State'},
    '12' : {'code':'MN','name':'Mon State'},
    '13' : {'code':'RK','name':'Rakhine State'},
    '14' : {'code':'SH','name':'Shan State'}
  },
  'NA':{
    '1' : {'code':'CA','name':'Caprivi'},
    '2' : {'code':'ER','name':'Erongo'},
    '3' : {'code':'HA','name':'Hardap'},
    '4' : {'code':'KR','name':'Karas'},
    '5' : {'code':'KV','name':'Kavango'},
    '6' : {'code':'KH','name':'Khomas'},
    '7' : {'code':'KU','name':'Kunene'},
    '8' : {'code':'OW','name':'Ohangwena'},
    '9' : {'code':'OK','name':'Omaheke'},
    '10' : {'code':'OT','name':'Omusati'},
    '11' : {'code':'ON','name':'Oshana'},
    '12' : {'code':'OO','name':'Oshikoto'},
    '13' : {'code':'OJ','name':'Otjozondjupa'}
  },
  'NR':{
    '1' : {'code':'AO','name':'Aiwo'},
    '2' : {'code':'AA','name':'Anabar'},
    '3' : {'code':'AT','name':'Anetan'},
    '4' : {'code':'AI','name':'Anibare'},
    '5' : {'code':'BA','name':'Baiti'},
    '6' : {'code':'BO','name':'Boe'},
    '7' : {'code':'BU','name':'Buada'},
    '8' : {'code':'DE','name':'Denigomodu'},
    '9' : {'code':'EW','name':'Ewa'},
    '10' : {'code':'IJ','name':'Ijuw'},
    '11' : {'code':'ME','name':'Meneng'},
    '12' : {'code':'NI','name':'Nibok'},
    '13' : {'code':'UA','name':'Uaboe'},
    '14' : {'code':'YA','name':'Yaren'}
  },
  'NP':{
    '1' : {'code':'BA','name':'Bagmati'},
    '2' : {'code':'BH','name':'Bheri'},
    '3' : {'code':'DH','name':'Dhawalagiri'},
    '4' : {'code':'GA','name':'Gandaki'},
    '5' : {'code':'JA','name':'Janakpur'},
    '6' : {'code':'KA','name':'Karnali'},
    '7' : {'code':'KO','name':'Kosi'},
    '8' : {'code':'LU','name':'Lumbini'},
    '9' : {'code':'MA','name':'Mahakali'},
    '10' : {'code':'ME','name':'Mechi'},
    '11' : {'code':'NA','name':'Narayani'},
    '12' : {'code':'RA','name':'Rapti'},
    '13' : {'code':'SA','name':'Sagarmatha'},
    '14' : {'code':'SE','name':'Seti'}
  },
  'NL':{
    '1' : {'code':'DR','name':'Drenthe'},
    '2' : {'code':'FL','name':'Flevoland'},
    '3' : {'code':'FR','name':'Friesland'},
    '4' : {'code':'GE','name':'Gelderland'},
    '5' : {'code':'GR','name':'Groningen'},
    '6' : {'code':'LI','name':'Limburg'},
    '7' : {'code':'NB','name':'Noord Brabant'},
    '8' : {'code':'NH','name':'Noord Holland'},
    '9' : {'code':'OV','name':'Overijssel'},
    '10' : {'code':'UT','name':'Utrecht'},
    '11' : {'code':'ZE','name':'Zeeland'},
    '12' : {'code':'ZH','name':'Zuid Holland'}
  },
  'AN':{
    '1' : {'code':'BON','name':'Bonaire'},
    '2' : {'code':'CUR','name':'Curaçao'},
    '3' : {'code':'SAB','name':'Saba'},
    '4' : {'code':'SEU','name':'Sint Eustatius'},
    '5' : {'code':'SMA','name':'Sint Maarten'}
  },
  'NC':{
    '1' : {'code':'L','name':'Iles Loyaute'},
    '2' : {'code':'N','name':'Nord'},
    '3' : {'code':'S','name':'Sud'}
  },
  'NZ':{
    '1' : {'code':'AUK','name':'Auckland'},
    '2' : {'code':'BOP','name':'Bay of Plenty'},
    '3' : {'code':'CAN','name':'Canterbury'},
    '4' : {'code':'COR','name':'Coromandel'},
    '5' : {'code':'GIS','name':'Gisborne'},
    '6' : {'code':'FIO','name':'Fiordland'},
    '7' : {'code':'HKB','name':'Hawke\'s Bay'},
    '8' : {'code':'MBH','name':'Marlborough'},
    '9' : {'code':'MWT','name':'Manawatu-Wanganui'},
    '10' : {'code':'MCM','name':'Mt Cook-Mackenzie'},
    '11' : {'code':'NSN','name':'Nelson'},
    '12' : {'code':'NTL','name':'Northland'},
    '13' : {'code':'OTA','name':'Otago'},
    '14' : {'code':'STL','name':'Southland'},
    '15' : {'code':'TKI','name':'Taranaki'},
    '16' : {'code':'WGN','name':'Wellington'},
    '17' : {'code':'WKO','name':'Waikato'},
    '18' : {'code':'WAI','name':'Wairprarapa'},
    '19' : {'code':'WTC','name':'West Coast'}
  },
  'NI':{
    '1' : {'code':'AN','name':'Atlantico Norte'},
    '2' : {'code':'AS','name':'Atlantico Sur'},
    '3' : {'code':'BO','name':'Boaco'},
    '4' : {'code':'CA','name':'Carazo'},
    '5' : {'code':'CI','name':'Chinandega'},
    '6' : {'code':'CO','name':'Chontales'},
    '7' : {'code':'ES','name':'Esteli'},
    '8' : {'code':'GR','name':'Granada'},
    '9' : {'code':'JI','name':'Jinotega'},
    '10' : {'code':'LE','name':'Leon'},
    '11' : {'code':'MD','name':'Madriz'},
    '12' : {'code':'MN','name':'Managua'},
    '13' : {'code':'MS','name':'Masaya'},
    '14' : {'code':'MT','name':'Matagalpa'},
    '15' : {'code':'NS','name':'Nuevo Segovia'},
    '16' : {'code':'RS','name':'Rio San Juan'},
    '17' : {'code':'RI','name':'Rivas'}
  },
  'NE':{
    '1' : {'code':'AG','name':'Agadez'},
    '2' : {'code':'DF','name':'Diffa'},
    '3' : {'code':'DS','name':'Dosso'},
    '4' : {'code':'MA','name':'Maradi'},
    '5' : {'code':'NM','name':'Niamey'},
    '6' : {'code':'TH','name':'Tahoua'},
    '7' : {'code':'TL','name':'Tillaberi'},
    '8' : {'code':'ZD','name':'Zinder'}
  },
  'NG':{
    '1' : {'code':'AB','name':'Abia'},
    '2' : {'code':'CT','name':'Abuja Federal Capital Territory'},
    '3' : {'code':'AD','name':'Adamawa'},
    '4' : {'code':'AK','name':'Akwa Ibom'},
    '5' : {'code':'AN','name':'Anambra'},
    '6' : {'code':'BC','name':'Bauchi'},
    '7' : {'code':'BY','name':'Bayelsa'},
    '8' : {'code':'BN','name':'Benue'},
    '9' : {'code':'BO','name':'Borno'},
    '10' : {'code':'CR','name':'Cross River'},
    '11' : {'code':'DE','name':'Delta'},
    '12' : {'code':'EB','name':'Ebonyi'},
    '13' : {'code':'ED','name':'Edo'},
    '14' : {'code':'EK','name':'Ekiti'},
    '15' : {'code':'EN','name':'Enugu'},
    '16' : {'code':'GO','name':'Gombe'},
    '17' : {'code':'IM','name':'Imo'},
    '18' : {'code':'JI','name':'Jigawa'},
    '19' : {'code':'KD','name':'Kaduna'},
    '20' : {'code':'KN','name':'Kano'},
    '21' : {'code':'KT','name':'Katsina'},
    '22' : {'code':'KE','name':'Kebbi'},
    '23' : {'code':'KO','name':'Kogi'},
    '24' : {'code':'KW','name':'Kwara'},
    '25' : {'code':'LA','name':'Lagos'},
    '26' : {'code':'NA','name':'Nassarawa'},
    '27' : {'code':'NI','name':'Niger'},
    '28' : {'code':'OG','name':'Ogun'},
    '29' : {'code':'ONG','name':'Ondo'},
    '30' : {'code':'OS','name':'Osun'},
    '31' : {'code':'OY','name':'Oyo'},
    '32' : {'code':'PL','name':'Plateau'},
    '33' : {'code':'RI','name':'Rivers'},
    '34' : {'code':'SO','name':'Sokoto'},
    '35' : {'code':'TA','name':'Taraba'},
    '36' : {'code':'YO','name':'Yobe'},
    '37' : {'code':'ZA','name':'Zamfara'}
  },
  'NU':{
    '1' : {'code':'MAK','name':'Makefu'},
    '2' : {'code':'TUA','name':'Tuapa'},
    '3' : {'code':'NAM','name':'Namukulu'},
    '4' : {'code':'HIK','name':'Hikutavake'},
    '5' : {'code':'TOI','name':'Toi'},
    '6' : {'code':'MUT','name':'Mutalau'},
    '7' : {'code':'LAK','name':'Lakepa'},
    '8' : {'code':'LIK','name':'Liku'},
    '9' : {'code':'HAK','name':'Hakupu'},
    '10' : {'code':'VAI','name':'Vaiea'},
    '11' : {'code':'AVA','name':'Avatele'},
    '12' : {'code':'TAM','name':'Tamakautoga'},
    '13' : {'code':'ALO','name':'Alofi South'},
    '14' : {'code':'ALO','name':'Alofi North'}
  },
  'NF':{
    '1' : {'code':'NOR','name':'Norfolk Island'}
  },
  'MP':{
    '1' : {'code':'N','name':'Northern Islands'},
    '2' : {'code':'R','name':'Rota'},
    '3' : {'code':'S','name':'Saipan'},
    '4' : {'code':'T','name':'Tinian'}
  },
  'NO':{
    '1' : {'code':'AK','name':'Akershus'},
    '2' : {'code':'AA','name':'Aust-Agder'},
    '3' : {'code':'BU','name':'Buskerud'},
    '4' : {'code':'FM','name':'Finnmark'},
    '5' : {'code':'HM','name':'Hedmark'},
    '6' : {'code':'HL','name':'Hordaland'},
    '7' : {'code':'MR','name':'Møre og Romsdal'},
    '8' : {'code':'NL','name':'Nordland'},
    '9' : {'code':'NT','name':'Nord-Trøndelag'},
    '10' : {'code':'OP','name':'Oppland'},
    '11' : {'code':'OL','name':'Oslo'},
    '12' : {'code':'RL','name':'Rogaland'},
    '13' : {'code':'SJ','name':'Sogn og Fjordane'},
    '14' : {'code':'ST','name':'Sør-Trøndelag'},
    '15' : {'code':'SV','name':'Svalbard'},
    '16' : {'code':'TM','name':'Telemark'},
    '17' : {'code':'TR','name':'Troms'},
    '18' : {'code':'VA','name':'Vest-Agder'},
    '19' : {'code':'VF','name':'Vestfold'},
    '20' : {'code':'OF','name':'Østfold'}
  },
  'OM':{
    '1' : {'code':'DA','name':'Ad Dakhiliyah'},
    '2' : {'code':'BA','name':'Al Batinah'},
    '3' : {'code':'WU','name':'Al Wusta'},
    '4' : {'code':'SH','name':'Ash Sharqiyah'},
    '5' : {'code':'ZA','name':'Az Zahirah'},
    '6' : {'code':'MA','name':'Masqat'},
    '7' : {'code':'MU','name':'Musandam'},
    '8' : {'code':'ZU','name':'Zufar'}
  },
  'PK':{
    '1' : {'code':'B','name':'Balochistan'},
    '2' : {'code':'T','name':'Federally Administered Tribal Ar'},
    '3' : {'code':'I','name':'Islamabad Capital Territory'},
    '4' : {'code':'N','name':'North-West Frontier'},
    '5' : {'code':'P','name':'Punjab'},
    '6' : {'code':'S','name':'Sindh'}
  },
  'PW':{
    '1' : {'code':'AM','name':'Aimeliik'},
    '2' : {'code':'AR','name':'Airai'},
    '3' : {'code':'AN','name':'Angaur'},
    '4' : {'code':'HA','name':'Hatohobei'},
    '5' : {'code':'KA','name':'Kayangel'},
    '6' : {'code':'KO','name':'Koror'},
    '7' : {'code':'ME','name':'Melekeok'},
    '8' : {'code':'NA','name':'Ngaraard'},
    '9' : {'code':'NG','name':'Ngarchelong'},
    '10' : {'code':'ND','name':'Ngardmau'},
    '11' : {'code':'NT','name':'Ngatpang'},
    '12' : {'code':'NC','name':'Ngchesar'},
    '13' : {'code':'NR','name':'Ngeremlengui'},
    '14' : {'code':'NW','name':'Ngiwal'},
    '15' : {'code':'PE','name':'Peleliu'},
    '16' : {'code':'SO','name':'Sonsorol'}
  },
  'PA':{
    '1' : {'code':'BT','name':'Bocas del Toro'},
    '2' : {'code':'CH','name':'Chiriqui'},
    '3' : {'code':'CC','name':'Cocle'},
    '4' : {'code':'CL','name':'Colon'},
    '5' : {'code':'DA','name':'Darien'},
    '6' : {'code':'HE','name':'Herrera'},
    '7' : {'code':'LS','name':'Los Santos'},
    '8' : {'code':'PA','name':'Panama'},
    '9' : {'code':'SB','name':'San Blas'},
    '10' : {'code':'VG','name':'Veraguas'}
  },
  'PG':{
    '1' : {'code':'BV','name':'Bougainville'},
    '2' : {'code':'CE','name':'Central'},
    '3' : {'code':'CH','name':'Chimbu'},
    '4' : {'code':'EH','name':'Eastern Highlands'},
    '5' : {'code':'EB','name':'East New Britain'},
    '6' : {'code':'ES','name':'East Sepik'},
    '7' : {'code':'EN','name':'Enga'},
    '8' : {'code':'GU','name':'Gulf'},
    '9' : {'code':'MD','name':'Madang'},
    '10' : {'code':'MN','name':'Manus'},
    '11' : {'code':'MB','name':'Milne Bay'},
    '12' : {'code':'MR','name':'Morobe'},
    '13' : {'code':'NC','name':'National Capital'},
    '14' : {'code':'NI','name':'New Ireland'},
    '15' : {'code':'NO','name':'Northern'},
    '16' : {'code':'SA','name':'Sandaun'},
    '17' : {'code':'SH','name':'Southern Highlands'},
    '18' : {'code':'WE','name':'Western'},
    '19' : {'code':'WH','name':'Western Highlands'},
    '20' : {'code':'WB','name':'West New Britain'}
  },
  'PY':{
    '1' : {'code':'AG','name':'Alto Paraguay'},
    '2' : {'code':'AN','name':'Alto Parana'},
    '3' : {'code':'AM','name':'Amambay'},
    '4' : {'code':'AS','name':'Asuncion'},
    '5' : {'code':'BO','name':'Boqueron'},
    '6' : {'code':'CG','name':'Caaguazu'},
    '7' : {'code':'CZ','name':'Caazapa'},
    '8' : {'code':'CN','name':'Canindeyu'},
    '9' : {'code':'CE','name':'Central'},
    '10' : {'code':'CC','name':'Concepcion'},
    '11' : {'code':'CD','name':'Cordillera'},
    '12' : {'code':'GU','name':'Guaira'},
    '13' : {'code':'IT','name':'Itapua'},
    '14' : {'code':'MI','name':'Misiones'},
    '15' : {'code':'NE','name':'Neembucu'},
    '16' : {'code':'PA','name':'Paraguari'},
    '17' : {'code':'PH','name':'Presidente Hayes'},
    '18' : {'code':'SP','name':'San Pedro'}
  },
  'PE':{
    '1' : {'code':'AM','name':'Amazonas'},
    '2' : {'code':'AN','name':'Ancash'},
    '3' : {'code':'AP','name':'Apurimac'},
    '4' : {'code':'AR','name':'Arequipa'},
    '5' : {'code':'AY','name':'Ayacucho'},
    '6' : {'code':'CJ','name':'Cajamarca'},
    '7' : {'code':'CL','name':'Callao'},
    '8' : {'code':'CU','name':'Cusco'},
    '9' : {'code':'HV','name':'Huancavelica'},
    '10' : {'code':'HO','name':'Huanuco'},
    '11' : {'code':'IC','name':'Ica'},
    '12' : {'code':'JU','name':'Junin'},
    '13' : {'code':'LD','name':'La Libertad'},
    '14' : {'code':'LY','name':'Lambayeque'},
    '15' : {'code':'LI','name':'Lima'},
    '16' : {'code':'LO','name':'Loreto'},
    '17' : {'code':'MD','name':'Madre de Dios'},
    '18' : {'code':'MO','name':'Moquegua'},
    '19' : {'code':'PA','name':'Pasco'},
    '20' : {'code':'PI','name':'Piura'},
    '21' : {'code':'PU','name':'Puno'},
    '22' : {'code':'SM','name':'San Martin'},
    '23' : {'code':'TA','name':'Tacna'},
    '24' : {'code':'TU','name':'Tumbes'},
    '25' : {'code':'UC','name':'Ucayali'}
  },
  'PH':{
    '1' : {'code':'ABR','name':'Abra'},
    '2' : {'code':'ANO','name':'Agusan del Norte'},
    '3' : {'code':'ASU','name':'Agusan del Sur'},
    '4' : {'code':'AKL','name':'Aklan'},
    '5' : {'code':'ALB','name':'Albay'},
    '6' : {'code':'ANT','name':'Antique'},
    '7' : {'code':'APY','name':'Apayao'},
    '8' : {'code':'AUR','name':'Aurora'},
    '9' : {'code':'BAS','name':'Basilan'},
    '10' : {'code':'BTA','name':'Bataan'},
    '11' : {'code':'BTE','name':'Batanes'},
    '12' : {'code':'BTG','name':'Batangas'},
    '13' : {'code':'BLR','name':'Biliran'},
    '14' : {'code':'BEN','name':'Benguet'},
    '15' : {'code':'BOL','name':'Bohol'},
    '16' : {'code':'BUK','name':'Bukidnon'},
    '17' : {'code':'BUL','name':'Bulacan'},
    '18' : {'code':'CAG','name':'Cagayan'},
    '19' : {'code':'CNO','name':'Camarines Norte'},
    '20' : {'code':'CSU','name':'Camarines Sur'},
    '21' : {'code':'CAM','name':'Camiguin'},
    '22' : {'code':'CAP','name':'Capiz'},
    '23' : {'code':'CAT','name':'Catanduanes'},
    '24' : {'code':'CAV','name':'Cavite'},
    '25' : {'code':'CEB','name':'Cebu'},
    '26' : {'code':'CMP','name':'Compostela'},
    '27' : {'code':'DNO','name':'Davao del Norte'},
    '28' : {'code':'DSU','name':'Davao del Sur'},
    '29' : {'code':'DOR','name':'Davao Oriental'},
    '30' : {'code':'ESA','name':'Eastern Samar'},
    '31' : {'code':'GUI','name':'Guimaras'},
    '32' : {'code':'IFU','name':'Ifugao'},
    '33' : {'code':'INO','name':'Ilocos Norte'},
    '34' : {'code':'ISU','name':'Ilocos Sur'},
    '35' : {'code':'ILO','name':'Iloilo'},
    '36' : {'code':'ISA','name':'Isabela'},
    '37' : {'code':'KAL','name':'Kalinga'},
    '38' : {'code':'LAG','name':'Laguna'},
    '39' : {'code':'LNO','name':'Lanao del Norte'},
    '40' : {'code':'LSU','name':'Lanao del Sur'},
    '41' : {'code':'UNI','name':'La Union'},
    '42' : {'code':'LEY','name':'Leyte'},
    '43' : {'code':'MAG','name':'Maguindanao'},
    '44' : {'code':'MRN','name':'Marinduque'},
    '45' : {'code':'MSB','name':'Masbate'},
    '46' : {'code':'MIC','name':'Mindoro Occidental'},
    '47' : {'code':'MIR','name':'Mindoro Oriental'},
    '48' : {'code':'MSC','name':'Misamis Occidental'},
    '49' : {'code':'MOR','name':'Misamis Oriental'},
    '50' : {'code':'MOP','name':'Mountain'},
    '51' : {'code':'NOC','name':'Negros Occidental'},
    '52' : {'code':'NOR','name':'Negros Oriental'},
    '53' : {'code':'NCT','name':'North Cotabato'},
    '54' : {'code':'NSM','name':'Northern Samar'},
    '55' : {'code':'NEC','name':'Nueva Ecija'},
    '56' : {'code':'NVZ','name':'Nueva Vizcaya'},
    '57' : {'code':'PLW','name':'Palawan'},
    '58' : {'code':'PMP','name':'Pampanga'},
    '59' : {'code':'PNG','name':'Pangasinan'},
    '60' : {'code':'QZN','name':'Quezon'},
    '61' : {'code':'QRN','name':'Quirino'},
    '62' : {'code':'RIZ','name':'Rizal'},
    '63' : {'code':'ROM','name':'Romblon'},
    '64' : {'code':'SMR','name':'Samar'},
    '65' : {'code':'SRG','name':'Sarangani'},
    '66' : {'code':'SQJ','name':'Siquijor'},
    '67' : {'code':'SRS','name':'Sorsogon'},
    '68' : {'code':'SCO','name':'South Cotabato'},
    '69' : {'code':'SLE','name':'Southern Leyte'},
    '70' : {'code':'SKU','name':'Sultan Kudarat'},
    '71' : {'code':'SLU','name':'Sulu'},
    '72' : {'code':'SNO','name':'Surigao del Norte'},
    '73' : {'code':'SSU','name':'Surigao del Sur'},
    '74' : {'code':'TAR','name':'Tarlac'},
    '75' : {'code':'TAW','name':'Tawi-Tawi'},
    '76' : {'code':'ZBL','name':'Zambales'},
    '77' : {'code':'ZNO','name':'Zamboanga del Norte'},
    '78' : {'code':'ZSU','name':'Zamboanga del Sur'},
    '79' : {'code':'ZSI','name':'Zamboanga Sibugay'}
  },
  'PN':{
    '1' : {'code':'PIT','name':'Pitcairn Island'}
  },
  'PL':{
    '1': {'code':'DO','name':'Dolnośląskie'},
    '2' : {'code':'KP','name':'Kujawsko-Pomorskie'},
    '3': {'code':'LL','name':'Lubelskie'},
    '4': {'code':'LU','name':'Lubuskie'},
    '5': {'code':'LO','name':'Łódzkie'},
    '6': {'code':'ML','name':'Małopolskie'},
    '7' : {'code':'MZ','name':'Mazowieckie'},
    '8' : {'code':'OP','name':'Opolskie'},
    '9' : {'code':'PP','name':'Podkarpackie'},
    '10' : {'code':'PL','name':'Podlaskie'},
    '11' : {'code':'PM','name':'Pomorskie'},
    '12': {'code':'SL','name':'Śląskie'},
    '13': {'code':'SW','name':'Świętokrzyskie'},
    '14': {'code':'WM','name':'Warmińsko-Mazurskie'},
    '15' : {'code':'WP','name':'Wielkopolskie'},
    '16' : {'code':'ZA','name':'Zachodniopomorskie'}
  },
  'PT':{
    '1' : {'code':'AC','name':'Açores'},
    '2' : {'code':'AV','name':'Aveiro'},
    '3' : {'code':'BE','name':'Beja'},
    '4' : {'code':'BR','name':'Braga'},
    '5' : {'code':'BA','name':'Bragança'},
    '6' : {'code':'CB','name':'Castelo Branco'},
    '7' : {'code':'CO','name':'Coimbra'},
    '8' : {'code':'EV','name':'évora'},
    '9' : {'code':'FA','name':'Faro'},
    '10' : {'code':'GU','name':'Guarda'},
    '12' : {'code':'LE','name':'Leiria'},
    '13' : {'code':'LI','name':'Lisboa'},
    '14' : {'code':'ME','name':'Madeira'},
    '15' : {'code':'PO','name':'Portalegre'},
    '16' : {'code':'PR','name':'Porto'},
    '17' : {'code':'SA','name':'Santarém'},
    '18' : {'code':'SE','name':'SetÚbal'},
    '19' : {'code':'VC','name':'Viana do Castelo'},
    '20' : {'code':'VR','name':'Vila Real'},
    '21' : {'code':'VI','name':'Viseu'}
  },
  'PR':{
    '1' : {'code':'A-A','name':'Añasco'},
    '2' : {'code':'ADJ','name':'Adjuntas'},
    '3' : {'code':'AGU','name':'Aguada'},
    '4' : {'code':'AGU','name':'Aguadilla'},
    '5' : {'code':'AGU','name':'Aguas Buenas'},
    '6' : {'code':'AIB','name':'Aibonito'},
    '7' : {'code':'ARE','name':'Arecibo'},
    '8' : {'code':'ARR','name':'Arroyo'},
    '9' : {'code':'BAR','name':'Barceloneta'},
    '10' : {'code':'BAR','name':'Barranquitas'},
    '11' : {'code':'BAY','name':'Bayamón'},
    '12' : {'code':'CAB','name':'Cabo Rojo'},
    '13' : {'code':'CAG','name':'Caguas'},
    '14' : {'code':'CAM','name':'Camuy'},
    '15' : {'code':'CAN','name':'Canóvanas'},
    '16' : {'code':'CAR','name':'Carolina'},
    '17' : {'code':'CAT','name':'Cataño'},
    '18' : {'code':'CAY','name':'Cayey'},
    '19' : {'code':'CEI','name':'Ceiba'},
    '20' : {'code':'CIA','name':'Ciales'},
    '21' : {'code':'CID','name':'Cidra'},
    '22' : {'code':'COA','name':'Coamo'},
    '23' : {'code':'COM','name':'Comerío'},
    '24' : {'code':'COR','name':'Corozal'},
    '25' : {'code':'CUL','name':'Culebra'},
    '26' : {'code':'DOR','name':'Dorado'},
    '27' : {'code':'FAJ','name':'Fajardo'},
    '28' : {'code':'FLO','name':'Florida'},
    '29' : {'code':'GUA','name':'Guayama'},
    '30' : {'code':'GUA','name':'Guayanilla'},
    '31' : {'code':'GUA','name':'Guaynabo'},
    '32' : {'code':'GUR','name':'Gurabo'},
    '33' : {'code':'GU¡','name':'Guánica'},
    '34' : {'code':'HAT','name':'Hatillo'},
    '35' : {'code':'HOR','name':'Hormigueros'},
    '36' : {'code':'HUM','name':'Humacao'},
    '37' : {'code':'ISA','name':'Isabela'},
    '38' : {'code':'JAY','name':'Jayuya'},
    '39' : {'code':'JUA','name':'Juana Díaz'},
    '40' : {'code':'JUN','name':'Juncos'},
    '41' : {'code':'LAJ','name':'Lajas'},
    '42' : {'code':'LAR','name':'Lares'},
    '43' : {'code':'LAS','name':'Las Marías'},
    '44' : {'code':'LAS','name':'Las Piedras'},
    '45' : {'code':'LOÕ','name':'Loíza'},
    '46' : {'code':'LUQ','name':'Luquillo'},
    '47' : {'code':'MAN','name':'Manatí'},
    '48' : {'code':'MAR','name':'Maricao'},
    '49' : {'code':'MAU','name':'Maunabo'},
    '50' : {'code':'MAY','name':'Mayagüez'},
    '51' : {'code':'MOC','name':'Moca'},
    '52' : {'code':'MOR','name':'Morovis'},
    '53' : {'code':'NAG','name':'Naguabo'},
    '54' : {'code':'NAR','name':'Naranjito'},
    '55' : {'code':'ORO','name':'Orocovis'},
    '56' : {'code':'PAT','name':'Patillas'},
    '57' : {'code':'PE-','name':'Peñuelas'},
    '58' : {'code':'PON','name':'Ponce'},
    '59' : {'code':'QUE','name':'Quebradillas'},
    '60' : {'code':'RIN','name':'Rincón'},
    '61' : {'code':'RIO','name':'Rio Grande'},
    '62' : {'code':'SAB','name':'Sabana Grande'},
    '63' : {'code':'SAL','name':'Salinas'},
    '64' : {'code':'SAN','name':'San Germàn'},
    '65' : {'code':'SAN','name':'San Juan'},
    '66' : {'code':'SAN','name':'San Lorenzo'},
    '67' : {'code':'SAN','name':'San Sebastiàn'},
    '68' : {'code':'SAN','name':'Santa Isabel'},
    '69' : {'code':'TOA','name':'Toa Alta'},
    '70' : {'code':'TOA','name':'Toa Baja'},
    '71' : {'code':'TRU','name':'Trujillo Alto'},
    '72' : {'code':'UTU','name':'Utuado'},
    '73' : {'code':'VEG','name':'Vega Alta'},
    '74' : {'code':'VEG','name':'Vega Baja'},
    '75' : {'code':'VIE','name':'Vieques'},
    '76' : {'code':'VIL','name':'Villalba'},
    '77' : {'code':'YAB','name':'Yabucoa'},
    '78' : {'code':'YAU','name':'Yauco'}
  },
  'QA':{
    '1' : {'code':'DW','name':'Ad Dawhah'},
    '2' : {'code':'GW','name':'Al Ghuwayriyah'},
    '3' : {'code':'JM','name':'Al Jumayliyah'},
    '4' : {'code':'KR','name':'Al Khawr'},
    '5' : {'code':'WK','name':'Al Wakrah'},
    '6' : {'code':'RN','name':'Ar Rayyan'},
    '7' : {'code':'JB','name':'Jarayan al Batinah'},
    '8' : {'code':'MS','name':'Madinat ash Shamal'},
    '9' : {'code':'UD','name':'Umm Sa\'id'},
    '10' : {'code':'UL','name':'Umm Salal'}
  },
  'RO':{
    '1' : {'code':'AB','name':'Alba'},
    '2' : {'code':'AR','name':'Arad'},
    '3' : {'code':'AG','name':'Arges'},
    '4' : {'code':'BC','name':'Bacau'},
    '5' : {'code':'BH','name':'Bihor'},
    '6' : {'code':'BN','name':'Bistrita-Nasaud'},
    '7' : {'code':'BT','name':'Botosani'},
    '8' : {'code':'BV','name':'Brasov'},
    '9' : {'code':'BR','name':'Braila'},
    '10' : {'code':'B','name':'Bucuresti'},
    '11' : {'code':'BZ','name':'Buzau'},
    '12' : {'code':'CS','name':'Caras-Severin'},
    '13' : {'code':'CL','name':'Calarasi'},
    '14' : {'code':'CJ','name':'Cluj'},
    '15' : {'code':'CT','name':'Constanta'},
    '16' : {'code':'CV','name':'Covasna'},
    '17' : {'code':'DB','name':'Dimbovita'},
    '18' : {'code':'DJ','name':'Dolj'},
    '19' : {'code':'GL','name':'Galati'},
    '20' : {'code':'GR','name':'Giurgiu'},
    '21' : {'code':'GJ','name':'Gorj'},
    '22' : {'code':'HR','name':'Harghita'},
    '23' : {'code':'HD','name':'Hunedoara'},
    '24' : {'code':'IL','name':'Ialomita'},
    '25' : {'code':'IS','name':'Iasi'},
    '26' : {'code':'IF','name':'Ilfov'},
    '27' : {'code':'MM','name':'Maramures'},
    '28' : {'code':'MH','name':'Mehedinti'},
    '29' : {'code':'MS','name':'Mures'},
    '30' : {'code':'NT','name':'Neamt'},
    '31' : {'code':'OT','name':'Olt'},
    '32' : {'code':'PH','name':'Prahova'},
    '33' : {'code':'SM','name':'Satu-Mare'},
    '34' : {'code':'SJ','name':'Salaj'},
    '35' : {'code':'SB','name':'Sibiu'},
    '36' : {'code':'SV','name':'Suceava'},
    '37' : {'code':'TR','name':'Teleorman'},
    '38' : {'code':'TM','name':'Timis'},
    '39' : {'code':'TL','name':'Tulcea'},
    '40' : {'code':'VS','name':'Vaslui'},
    '41' : {'code':'VL','name':'Valcea'},
    '42' : {'code':'VN','name':'Vrancea'}
  },
  'RU':{
    '1' : {'code':'AB','name':'Abakan'},
    '2' : {'code':'AG','name':'Aginskoye'},
    '3' : {'code':'AN','name':'Anadyr'},
    '4' : {'code':'AR','name':'Arkahangelsk'},
    '5' : {'code':'AS','name':'Astrakhan'},
    '6' : {'code':'BA','name':'Barnaul'},
    '7' : {'code':'BE','name':'Belgorod'},
    '8' : {'code':'BI','name':'Birobidzhan'},
    '9' : {'code':'BL','name':'Blagoveshchensk'},
    '10' : {'code':'BR','name':'Bryansk'},
    '11' : {'code':'CH','name':'Cheboksary'},
    '12' : {'code':'CL','name':'Chelyabinsk'},
    '13' : {'code':'CR','name':'Cherkessk'},
    '14' : {'code':'CI','name':'Chita'},
    '15' : {'code':'DU','name':'Dudinka'},
    '16' : {'code':'EL','name':'Elista'},
    '17' : {'code':'GO','name':'Gomo-Altaysk'},
    '18' : {'code':'GA','name':'Gorno-Altaysk'},
    '19' : {'code':'GR','name':'Groznyy'},
    '20' : {'code':'IR','name':'Irkutsk'},
    '21' : {'code':'IV','name':'Ivanovo'},
    '22' : {'code':'IZ','name':'Izhevsk'},
    '23' : {'code':'KA','name':'Kalinigrad'},
    '24' : {'code':'KL','name':'Kaluga'},
    '25' : {'code':'KS','name':'Kasnodar'},
    '26' : {'code':'KZ','name':'Kazan'},
    '27' : {'code':'KE','name':'Kemerovo'},
    '28' : {'code':'KH','name':'Khabarovsk'},
    '29' : {'code':'KM','name':'Khanty-Mansiysk'},
    '30' : {'code':'KO','name':'Kostroma'},
    '31' : {'code':'KR','name':'Krasnodar'},
    '32' : {'code':'KN','name':'Krasnoyarsk'},
    '33' : {'code':'KU','name':'Kudymkar'},
    '34' : {'code':'KG','name':'Kurgan'},
    '35' : {'code':'KK','name':'Kursk'},
    '36' : {'code':'KY','name':'Kyzyl'},
    '37' : {'code':'LI','name':'Lipetsk'},
    '38' : {'code':'MA','name':'Magadan'},
    '39' : {'code':'MK','name':'Makhachkala'},
    '40' : {'code':'MY','name':'Maykop'},
    '41' : {'code':'MO','name':'Moscow'},
    '42' : {'code':'MU','name':'Murmansk'},
    '43' : {'code':'NA','name':'Nalchik'},
    '44' : {'code':'NR','name':'Naryan Mar'},
    '45' : {'code':'NZ','name':'Nazran'},
    '46' : {'code':'NI','name':'Nizhniy Novgorod'},
    '47' : {'code':'NO','name':'Novgorod'},
    '48' : {'code':'NV','name':'Novosibirsk'},
    '49' : {'code':'OM','name':'Omsk'},
    '50' : {'code':'OR','name':'Orel'},
    '51' : {'code':'OE','name':'Orenburg'},
    '52' : {'code':'PA','name':'Palana'},
    '53' : {'code':'PE','name':'Penza'},
    '54' : {'code':'PR','name':'Perm'},
    '55' : {'code':'PK','name':'Petropavlovsk-Kamchatskiy'},
    '56' : {'code':'PT','name':'Petrozavodsk'},
    '57' : {'code':'PS','name':'Pskov'},
    '58' : {'code':'RO','name':'Rostov-na-Donu'},
    '59' : {'code':'RY','name':'Ryazan'},
    '60' : {'code':'SL','name':'Salekhard'},
    '61' : {'code':'SA','name':'Samara'},
    '62' : {'code':'SR','name':'Saransk'},
    '63' : {'code':'SV','name':'Saratov'},
    '64' : {'code':'SM','name':'Smolensk'},
    '65' : {'code':'SP','name':'St. Petersburg'},
    '66' : {'code':'ST','name':'Stavropol'},
    '67' : {'code':'SY','name':'Syktyvkar'},
    '68' : {'code':'TA','name':'Tambov'},
    '69' : {'code':'TO','name':'Tomsk'},
    '70' : {'code':'TU','name':'Tula'},
    '71' : {'code':'TR','name':'Tura'},
    '72' : {'code':'TV','name':'Tver'},
    '73' : {'code':'TY','name':'Tyumen'},
    '74' : {'code':'UF','name':'Ufa'},
    '75' : {'code':'UL','name':'Ul\'yanovsk'},
    '76' : {'code':'UU','name':'Ulan-Ude'},
    '77' : {'code':'US','name':'Ust\'-Ordynskiy'},
    '78' : {'code':'VL','name':'Vladikavkaz'},
    '79' : {'code':'VA','name':'Vladimir'},
    '80' : {'code':'VV','name':'Vladivostok'},
    '81' : {'code':'VG','name':'Volgograd'},
    '82' : {'code':'VD','name':'Vologda'},
    '83' : {'code':'VO','name':'Voronezh'},
    '84' : {'code':'VY','name':'Vyatka'},
    '85' : {'code':'YA','name':'Yakutsk'},
    '86' : {'code':'YR','name':'Yaroslavl'},
    '87' : {'code':'YE','name':'Yekaterinburg'},
    '88' : {'code':'YO','name':'Yoshkar-Ola'}
  },
  'RW':{
    '1' : {'code':'BU','name':'Butare'},
    '2' : {'code':'BY','name':'Byumba'},
    '3' : {'code':'CY','name':'Cyangugu'},
    '4' : {'code':'GK','name':'Gikongoro'},
    '5' : {'code':'GS','name':'Gisenyi'},
    '6' : {'code':'GT','name':'Gitarama'},
    '7' : {'code':'KG','name':'Kibungo'},
    '8' : {'code':'KY','name':'Kibuye'},
    '9' : {'code':'KR','name':'Kigali Rurale'},
    '10' : {'code':'KV','name':'Kigali-ville'},
    '11' : {'code':'RU','name':'Ruhengeri'},
    '12' : {'code':'UM','name':'Umutara'}
  },
  'KN':{
    '1' : {'code':'CCN','name':'Christ Church Nichola Town'},
    '2' : {'code':'SAS','name':'Saint Anne Sandy Point'},
    '3' : {'code':'SGB','name':'Saint George Basseterre'},
    '4' : {'code':'SGG','name':'Saint George Gingerland'},
    '5' : {'code':'SJW','name':'Saint James Windward'},
    '6' : {'code':'SJC','name':'Saint John Capesterre'},
    '7' : {'code':'SJF','name':'Saint John Figtree'},
    '8' : {'code':'SMC','name':'Saint Mary Cayon'},
    '9' : {'code':'CAP','name':'Saint Paul Capesterre'},
    '10' : {'code':'CHA','name':'Saint Paul Charlestown'},
    '11' : {'code':'SPB','name':'Saint Peter Basseterre'},
    '12' : {'code':'STL','name':'Saint Thomas Lowland'},
    '13' : {'code':'STM','name':'Saint Thomas Middle Island'},
    '14' : {'code':'TPP','name':'Trinity Palmetto Point'}
  },
  'LC':{
    '1' : {'code':'AR','name':'Anse-la-Raye'},
    '2' : {'code':'CA','name':'Castries'},
    '3' : {'code':'CH','name':'Choiseul'},
    '4' : {'code':'DA','name':'Dauphin'},
    '5' : {'code':'DE','name':'Dennery'},
    '6' : {'code':'GI','name':'Gros-Islet'},
    '7' : {'code':'LA','name':'Laborie'},
    '8' : {'code':'MI','name':'Micoud'},
    '9' : {'code':'PR','name':'Praslin'},
    '10' : {'code':'SO','name':'Soufriere'},
    '11' : {'code':'VF','name':'Vieux-Fort'}
  },
  'VC':{
    '1' : {'code':'C','name':'Charlotte'},
    '2' : {'code':'R','name':'Grenadines'},
    '3' : {'code':'A','name':'Saint Andrew'},
    '4' : {'code':'D','name':'Saint David'},
    '5' : {'code':'G','name':'Saint George'},
    '6' : {'code':'P','name':'Saint Patrick'}
  },
  'WS':{
    '1' : {'code':'AN','name':'A\'ana'},
    '2' : {'code':'AI','name':'Aiga-i-le-Tai'},
    '3' : {'code':'AT','name':'Atua'},
    '4' : {'code':'FA','name':'Fa\'asaleleaga'},
    '5' : {'code':'GE','name':'Gaga\'emauga'},
    '6' : {'code':'GF','name':'Gagaifomauga'},
    '7' : {'code':'PA','name':'Palauli'},
    '8' : {'code':'SA','name':'Satupa\'itea'},
    '9' : {'code':'TU','name':'Tuamasaga'},
    '10' : {'code':'VF','name':'Va\'a-o-Fonoti'},
    '11' : {'code':'VS','name':'Vaisigano'}
  },
  'SM':{
    '1' : {'code':'AC','name':'Acquaviva'},
    '2' : {'code':'BM','name':'Borgo Maggiore'},
    '3' : {'code':'CH','name':'Chiesanuova'},
    '4' : {'code':'DO','name':'Domagnano'},
    '5' : {'code':'FA','name':'Faetano'},
    '6' : {'code':'FI','name':'Fiorentino'},
    '7' : {'code':'MO','name':'Montegiardino'},
    '8' : {'code':'SM','name':'Citta di San Marino'},
    '9' : {'code':'SE','name':'Serravalle'}
  },
  'ST':{
    '1' : {'code':'S','name':'Sao Tome'},
    '2' : {'code':'P','name':'Principe'}
  },
  'SA':{
    '1' : {'code':'BH','name':'Al Bahah'},
    '2' : {'code':'HS','name':'Al Hudud ash Shamaliyah'},
    '3' : {'code':'JF','name':'Al Jawf'},
    '4' : {'code':'MD','name':'Al Madinah'},
    '5' : {'code':'QS','name':'Al Qasim'},
    '6' : {'code':'RD','name':'Ar Riyad'},
    '7' : {'code':'AQ','name':'Ash Sharqiyah (Eastern)'},
    '8' : {'code':'AS','name':'\'Asir'},
    '9' : {'code':'HL','name':'Ha\'il'},
    '10' : {'code':'JZ','name':'Jizan'},
    '11' : {'code':'ML','name':'Makkah'},
    '12' : {'code':'NR','name':'Najran'},
    '13' : {'code':'TB','name':'Tabuk'}
  },
  'SN':{
    '1' : {'code':'DA','name':'Dakar'},
    '2' : {'code':'DI','name':'Diourbel'},
    '3' : {'code':'FA','name':'Fatick'},
    '4' : {'code':'KA','name':'Kaolack'},
    '5' : {'code':'KO','name':'Kolda'},
    '6' : {'code':'LO','name':'Louga'},
    '7' : {'code':'MA','name':'Matam'},
    '8' : {'code':'SL','name':'Saint-Louis'},
    '9' : {'code':'TA','name':'Tambacounda'},
    '10' : {'code':'TH','name':'Thies'},
    '11' : {'code':'ZI','name':'Ziguinchor'}
  },
  'SC':{
    '1' : {'code':'AP','name':'Anse aux Pins'},
    '2' : {'code':'AB','name':'Anse Boileau'},
    '3' : {'code':'AE','name':'Anse Etoile'},
    '4' : {'code':'AL','name':'Anse Louis'},
    '5' : {'code':'AR','name':'Anse Royale'},
    '6' : {'code':'BL','name':'Baie Lazare'},
    '7' : {'code':'BS','name':'Baie Sainte Anne'},
    '8' : {'code':'BV','name':'Beau Vallon'},
    '9' : {'code':'BA','name':'Bel Air'},
    '10' : {'code':'BO','name':'Bel Ombre'},
    '11' : {'code':'CA','name':'Cascade'},
    '12' : {'code':'GL','name':'Glacis'},
    '13' : {'code':'GM','name':'Grand\' Anse (on Mahe)'},
    '14' : {'code':'GP','name':'Grand\' Anse (on Praslin)'},
    '15' : {'code':'DG','name':'La Digue'},
    '16' : {'code':'RA','name':'La Riviere Anglaise'},
    '17' : {'code':'MB','name':'Mont Buxton'},
    '18' : {'code':'MF','name':'Mont Fleuri'},
    '19' : {'code':'PL','name':'Plaisance'},
    '20' : {'code':'PR','name':'Pointe La Rue'},
    '21' : {'code':'PG','name':'Port Glaud'},
    '22' : {'code':'SL','name':'Saint Louis'},
    '23' : {'code':'TA','name':'Takamaka'}
  },
  'SL':{
    '1' : {'code':'E','name':'Eastern'},
    '2' : {'code':'N','name':'Northern'},
    '3' : {'code':'S','name':'Southern'},
    '4' : {'code':'W','name':'Western'}
  },
  'SK':{
    '1' : {'code':'BA','name':'Banskobystricky'},
    '2' : {'code':'BR','name':'Bratislavsky'},
    '3' : {'code':'KO','name':'Kosicky'},
    '4' : {'code':'NI','name':'Nitriansky'},
    '5' : {'code':'PR','name':'Presovsky'},
    '6' : {'code':'TC','name':'Trenciansky'},
    '7' : {'code':'TV','name':'Trnavsky'},
    '8' : {'code':'ZI','name':'Zilinsky'}
  },
  'SI':{
    '1' : {'code':'4','name':'Štajerska'},
    '2' : {'code':'2A','name':'Gorenjska'},
    '3' : {'code':'5','name':'Prekmurje'},
    '4' : {'code':'3','name':'Koroška'},
    '5' : {'code':'2B','name':'Notranjska'},
    '6' : {'code':'1','name':'Primorska'},
    '7' : {'code':'2C','name':'Dolenjska'},
    '8' : {'code':'2C','name':'Bela Krajina'}
  },
  'SB':{
    '1' : {'code':'CE','name':'Central'},
    '2' : {'code':'CH','name':'Choiseul'},
    '3' : {'code':'GC','name':'Guadalcanal'},
    '4' : {'code':'HO','name':'Honiara'},
    '5' : {'code':'IS','name':'Isabel'},
    '6' : {'code':'MK','name':'Makira'},
    '7' : {'code':'ML','name':'Malaita'},
    '8' : {'code':'RB','name':'Rennell and Bellona'},
    '9' : {'code':'TM','name':'Temotu'},
    '10' : {'code':'WE','name':'Western'}
  },
  'SO':{
    '1' : {'code':'AW','name':'Awdal'},
    '2' : {'code':'BK','name':'Bakool'},
    '3' : {'code':'BN','name':'Banaadir'},
    '4' : {'code':'BR','name':'Bari'},
    '5' : {'code':'BY','name':'Bay'},
    '6' : {'code':'GA','name':'Galguduud'},
    '7' : {'code':'GE','name':'Gedo'},
    '8' : {'code':'HI','name':'Hiiraan'},
    '9' : {'code':'JD','name':'Jubbada Dhexe'},
    '10' : {'code':'JH','name':'Jubbada Hoose'},
    '11' : {'code':'MU','name':'Mudug'},
    '12' : {'code':'NU','name':'Nugaal'},
    '13' : {'code':'SA','name':'Sanaag'},
    '14' : {'code':'SD','name':'Shabeellaha Dhexe'},
    '15' : {'code':'SH','name':'Shabeellaha Hoose'},
    '16' : {'code':'SL','name':'Sool'},
    '17' : {'code':'TO','name':'Togdheer'},
    '18' : {'code':'WG','name':'Woqooyi Galbeed'}
  },
  'ZA':{
    '1' : {'code':'EC','name':'Eastern Cape'},
    '2' : {'code':'FS','name':'Free State'},
    '3' : {'code':'GT','name':'Gauteng'},
    '4' : {'code':'KN','name':'KwaZulu-Natal'},
    '5' : {'code':'LP','name':'Limpopo'},
    '6' : {'code':'MP','name':'Mpumalanga'},
    '7' : {'code':'NW','name':'North West'},
    '8' : {'code':'NC','name':'Northern Cape'},
    '9' : {'code':'WC','name':'Western Cape'}
  },
  'ES':{
    '1' : {'code':'CA','name':'La Coruña'},
    '2' : {'code':'AL','name':'Álava'},
    '3' : {'code':'AB','name':'Albacete'},
    '4' : {'code':'AC','name':'Alicante'},
    '5' : {'code':'AM','name':'Almeria'},
    '6' : {'code':'AS','name':'Asturias'},
    '7' : {'code':'AV','name':'Ávila'},
    '8' : {'code':'BJ','name':'Badajoz'},
    '9' : {'code':'IB','name':'Baleares'},
    '10' : {'code':'BA','name':'Barcelona'},
    '11' : {'code':'BU','name':'Burgos'},
    '12' : {'code':'CC','name':'Cáceres'},
    '13' : {'code':'CZ','name':'Cádiz'},
    '14' : {'code':'CT','name':'Cantabria'},
    '15' : {'code':'CL','name':'Castellón'},
    '16' : {'code':'CE','name':'Ceuta'},
    '17' : {'code':'CR','name':'Ciudad Real'},
    '18' : {'code':'CD','name':'Córdoba'},
    '19' : {'code':'CU','name':'Cuenca'},
    '20' : {'code':'GI','name':'Gerona'},
    '21' : {'code':'GD','name':'Granada'},
    '22' : {'code':'GJ','name':'Guadalajara'},
    '23' : {'code':'GP','name':'Guipúzcoa'},
    '24' : {'code':'HL','name':'Huelva'},
    '25' : {'code':'HS','name':'Huesca'},
    '26' : {'code':'JN','name':'Jaén'},
    '27' : {'code':'RJ','name':'La Rioja'},
    '28' : {'code':'PM','name':'Las Palmas'},
    '29' : {'code':'LE','name':'León'},
    '30' : {'code':'LL','name':'Lérida'},
    '31' : {'code':'LG','name':'Lugo'},
    '32' : {'code':'MD','name':'Madrid'},
    '33' : {'code':'MA','name':'Málaga'},
    '34' : {'code':'ML','name':'Melilla'},
    '35' : {'code':'MU','name':'Murcia'},
    '36' : {'code':'NV','name':'Navarra'},
    '37' : {'code':'OU','name':'Ourense'},
    '38' : {'code':'PL','name':'Palencia'},
    '39' : {'code':'PO','name':'Pontevedra'},
    '40' : {'code':'SL','name':'Salamanca'},
    '41' : {'code':'SC','name':'Santa Cruz de Tenerife'},
    '42' : {'code':'SG','name':'Segovia'},
    '43' : {'code':'SV','name':'Sevilla'},
    '44' : {'code':'SO','name':'Soria'},
    '45' : {'code':'TA','name':'Tarragona'},
    '46' : {'code':'TE','name':'Teruel'},
    '47' : {'code':'TO','name':'Toledo'},
    '48' : {'code':'VC','name':'Valencia'},
    '49' : {'code':'VD','name':'Valladolid'},
    '50' : {'code':'VZ','name':'Vizcaya'},
    '51' : {'code':'ZM','name':'Zamora'},
    '52' : {'code':'ZR','name':'Zaragoza'}
  },
  'LK':{
    '1' : {'code':'CE','name':'Central'},
    '2' : {'code':'EA','name':'Eastern'},
    '3' : {'code':'NC','name':'North Central'},
    '4' : {'code':'NO','name':'Northern'},
    '5' : {'code':'NW','name':'North Western'},
    '6' : {'code':'SA','name':'Sabaragamuwa'},
    '7' : {'code':'SO','name':'Southern'},
    '8' : {'code':'UV','name':'Uva'},
    '9' : {'code':'WE','name':'Western'}
  },
  'SH':{
    '1' : {'code':'A','name':'Ascension'},
    '2' : {'code':'S','name':'Saint Helena'},
    '3' : {'code':'T','name':'Tristan da Cunha'}
  },
  'PM':{
    '1' : {'code':'P','name':'Saint Pierre'},
    '2' : {'code':'M','name':'Miquelon'}
  },
  'SD':{
    '1' : {'code':'ANL','name':'A\'ali an Nil'},
    '2' : {'code':'BAM','name':'Al Bahr al Ahmar'},
    '3' : {'code':'BRT','name':'Al Buhayrat'},
    '4' : {'code':'JZR','name':'Al Jazirah'},
    '5' : {'code':'KRT','name':'Al Khartum'},
    '6' : {'code':'QDR','name':'Al Qadarif'},
    '7' : {'code':'WDH','name':'Al Wahdah'},
    '8' : {'code':'ANB','name':'An Nil al Abyad'},
    '9' : {'code':'ANZ','name':'An Nil al Azraq'},
    '10' : {'code':'ASH','name':'Ash Shamaliyah'},
    '11' : {'code':'BJA','name':'Bahr al Jabal'},
    '12' : {'code':'GIS','name':'Gharb al Istiwa\'iyah'},
    '13' : {'code':'GBG','name':'Gharb Bahr al Ghazal'},
    '14' : {'code':'GDA','name':'Gharb Darfur'},
    '15' : {'code':'GKU','name':'Gharb Kurdufan'},
    '16' : {'code':'JDA','name':'Janub Darfur'},
    '17' : {'code':'JKU','name':'Janub Kurdufan'},
    '18' : {'code':'JQL','name':'Junqali'},
    '19' : {'code':'KSL','name':'Kassala'},
    '20' : {'code':'NNL','name':'Nahr an Nil'},
    '21' : {'code':'SBG','name':'Shamal Bahr al Ghazal'},
    '22' : {'code':'SDA','name':'Shamal Darfur'},
    '23' : {'code':'SKU','name':'Shamal Kurdufan'},
    '24' : {'code':'SIS','name':'Sharq al Istiwa\'iyah'},
    '25' : {'code':'SNR','name':'Sinnar'},
    '26' : {'code':'WRB','name':'Warab'}
  },
  'SR':{
    '1' : {'code':'BR','name':'Brokopondo'},
    '2' : {'code':'CM','name':'Commewijne'},
    '3' : {'code':'CR','name':'Coronie'},
    '4' : {'code':'MA','name':'Marowijne'},
    '5' : {'code':'NI','name':'Nickerie'},
    '6' : {'code':'PA','name':'Para'},
    '7' : {'code':'PM','name':'Paramaribo'},
    '9' : {'code':'SA','name':'Saramacca'},
    '10' : {'code':'SI','name':'Sipaliwini'},
    '11' : {'code':'WA','name':'Wanica'}
  },
  'SZ':{
    '1' : {'code':'H','name':'Hhohho'},
    '2' : {'code':'L','name':'Lubombo'},
    '3' : {'code':'M','name':'Manzini'},
    '4' : {'code':'S','name':'Shishelweni'}
  },
  'SE':{
    '1' : {'code':'K','name':'Blekinge'},
    '2' : {'code':'W','name':'Dalama'},
    '3' : {'code':'I','name':'Gotland'},
    '4' : {'code':'X','name':'Gävleborg'},
    '5' : {'code':'N','name':'Halland'},
    '6' : {'code':'Z','name':'Jämtland'},
    '7' : {'code':'F','name':'Jönköping'},
    '8' : {'code':'H','name':'Kalmar'},
    '9' : {'code':'G','name':'Kronoberg'},
    '10' : {'code':'BD','name':'Norrbotten'},
    '11' : {'code':'M','name':'Skåne'},
    '12' : {'code':'AB','name':'Stockholm'},
    '13' : {'code':'D','name':'Södermanland'},
    '14' : {'code':'C','name':'Uppsala'},
    '15' : {'code':'S','name':'Värmland'},
    '16' : {'code':'AC','name':'Västerbotten'},
    '17' : {'code':'Y','name':'Västernorrland'},
    '18' : {'code':'U','name':'Västmanland'},
    '19' : {'code':'O','name':'Västra Götaland'},
    '20' : {'code':'T','name':'Örebro'},
    '21' : {'code':'E','name':'Östergötland'}
  },
  'CH':{
    '1' : {'code':'AG','name':'Aargau'},
    '2' : {'code':'AR','name':'Appenzell Ausserrhoden'},
    '3' : {'code':'AI','name':'Appenzell Innerrhoden'},
    '4' : {'code':'BS','name':'Basel-Stadt'},
    '5' : {'code':'BL','name':'Basel-Landschaft'},
    '6' : {'code':'BE','name':'Bern'},
    '7' : {'code':'FR','name':'Fribourg'},
    '8' : {'code':'GE','name':'Genève'},
    '9' : {'code':'GL','name':'Glarus'},
    '10' : {'code':'GR','name':'Graubünden'},
    '11' : {'code':'JU','name':'Jura'},
    '12' : {'code':'LU','name':'Lucerne'},
    '13' : {'code':'NE','name':'Neuchâtel'},
    '14' : {'code':'NW','name':'Nidwalden'},
    '15' : {'code':'OW','name':'Obwalden'},
    '16' : {'code':'SG','name':'St. Gallen'},
    '17' : {'code':'SH','name':'Schaffhausen'},
    '18' : {'code':'SZ','name':'Schwyz'},
    '19' : {'code':'SO','name':'Solothurn'},
    '20' : {'code':'TG','name':'Thurgau'},
    '21' : {'code':'TI','name':'Ticino'},
    '22' : {'code':'UR','name':'Uri'},
    '23' : {'code':'VS','name':'Valais'},
    '24' : {'code':'VD','name':'Vaud'},
    '25' : {'code':'ZG','name':'Zug'},
    '26' : {'code':'ZH','name':'Zürich'}
  },
  'SY':{
    '1' : {'code':'HA','name':'Al Hasakah'},
    '2' : {'code':'LA','name':'Al Ladhiqiyah'},
    '3' : {'code':'QU','name':'Al Qunaytirah'},
    '4' : {'code':'RQ','name':'Ar Raqqah'},
    '5' : {'code':'SU','name':'As Suwayda'},
    '6' : {'code':'DA','name':'Dara'},
    '7' : {'code':'DZ','name':'Dayr az Zawr'},
    '8' : {'code':'DI','name':'Dimashq'},
    '9' : {'code':'HL','name':'Halab'},
    '10' : {'code':'HM','name':'Hamah'},
    '11' : {'code':'HI','name':'Hims'},
    '12' : {'code':'ID','name':'Idlib'},
    '13' : {'code':'RD','name':'Rif Dimashq'},
    '14' : {'code':'TA','name':'Tartus'}
  },
  'TW':{
    '1' : {'code':'CH','name':'Chang-hua'},
    '2' : {'code':'CI','name':'Chia-i'},
    '3' : {'code':'HS','name':'Hsin-chu'},
    '4' : {'code':'HL','name':'Hua-lien'},
    '5' : {'code':'IL','name':'I-lan'},
    '6' : {'code':'KH','name':'Kao-hsiung county'},
    '7' : {'code':'KM','name':'Kin-men'},
    '8' : {'code':'LC','name':'Lien-chiang'},
    '9' : {'code':'ML','name':'Miao-li'},
    '10' : {'code':'NT','name':'Nan-t\'ou'},
    '11' : {'code':'PH','name':'P\'eng-hu'},
    '12' : {'code':'PT','name':'P\'ing-tung'},
    '13' : {'code':'TG','name':'T\'ai-chung'},
    '14' : {'code':'TA','name':'T\'ai-nan'},
    '15' : {'code':'TP','name':'T\'ai-pei county'},
    '16' : {'code':'TT','name':'T\'ai-tung'},
    '17' : {'code':'TY','name':'T\'ao-yuan'},
    '18' : {'code':'YL','name':'Yun-lin'},
    '19' : {'code':'CC','name':'Chia-i city'},
    '20' : {'code':'CL','name':'Chi-lung'},
    '21' : {'code':'HC','name':'Hsin-chu'},
    '22' : {'code':'TH','name':'T\'ai-chung'},
    '23' : {'code':'TN','name':'T\'ai-nan'},
    '24' : {'code':'KC','name':'Kao-hsiung city'},
    '25' : {'code':'TC','name':'T\'ai-pei city'}
  },
  'TJ':{
    '1' : {'code':'GB','name':'Gorno-Badakhstan'},
    '2' : {'code':'KT','name':'Khatlon'},
    '3' : {'code':'SU','name':'Sughd'}
  },
  'TZ':{
    '1' : {'code':'AR','name':'Arusha'},
    '2' : {'code':'DS','name':'Dar es Salaam'},
    '3' : {'code':'DO','name':'Dodoma'},
    '4' : {'code':'IR','name':'Iringa'},
    '5' : {'code':'KA','name':'Kagera'},
    '6' : {'code':'KI','name':'Kigoma'},
    '7' : {'code':'KJ','name':'Kilimanjaro'},
    '8' : {'code':'LN','name':'Lindi'},
    '9' : {'code':'MY','name':'Manyara'},
    '10' : {'code':'MR','name':'Mara'},
    '11' : {'code':'MB','name':'Mbeya'},
    '12' : {'code':'MO','name':'Morogoro'},
    '13' : {'code':'MT','name':'Mtwara'},
    '14' : {'code':'MW','name':'Mwanza'},
    '15' : {'code':'PN','name':'Pemba North'},
    '16' : {'code':'PS','name':'Pemba South'},
    '17' : {'code':'PW','name':'Pwani'},
    '18' : {'code':'RK','name':'Rukwa'},
    '19' : {'code':'RV','name':'Ruvuma'},
    '20' : {'code':'SH','name':'Shinyanga'},
    '21' : {'code':'SI','name':'Singida'},
    '22' : {'code':'TB','name':'Tabora'},
    '23' : {'code':'TN','name':'Tanga'},
    '24' : {'code':'ZC','name':'Zanzibar Central/South'},
    '25' : {'code':'ZN','name':'Zanzibar North'},
    '26' : {'code':'ZU','name':'Zanzibar Urban/West'}
  },
  'TH':{
    '1' : {'code':'Amnat Charoen','name':'Amnat Charoen'},
    '2' : {'code':'Ang Thong','name':'Ang Thong'},
    '3' : {'code':'Ayutthaya','name':'Ayutthaya'},
    '4' : {'code':'Bangkok','name':'Bangkok'},
    '5' : {'code':'Buriram','name':'Buriram'},
    '6' : {'code':'Chachoengsao','name':'Chachoengsao'},
    '7' : {'code':'Chai Nat','name':'Chai Nat'},
    '8' : {'code':'Chaiyaphum','name':'Chaiyaphum'},
    '9' : {'code':'Chanthaburi','name':'Chanthaburi'},
    '10' : {'code':'Chiang Mai','name':'Chiang Mai'},
    '11' : {'code':'Chiang Rai','name':'Chiang Rai'},
    '12' : {'code':'Chon Buri','name':'Chon Buri'},
    '13' : {'code':'Chumphon','name':'Chumphon'},
    '14' : {'code':'Kalasin','name':'Kalasin'},
    '15' : {'code':'Kamphaeng Phet','name':'Kamphaeng Phet'},
    '16' : {'code':'Kanchanaburi','name':'Kanchanaburi'},
    '17' : {'code':'Khon Kaen','name':'Khon Kaen'},
    '18' : {'code':'Krabi','name':'Krabi'},
    '19' : {'code':'Lampang','name':'Lampang'},
    '20' : {'code':'Lamphun','name':'Lamphun'},
    '21' : {'code':'Loei','name':'Loei'},
    '22' : {'code':'Lop Buri','name':'Lop Buri'},
    '23' : {'code':'Mae Hong Son','name':'Mae Hong Son'},
    '24' : {'code':'Maha Sarakham','name':'Maha Sarakham'},
    '25' : {'code':'Mukdahan','name':'Mukdahan'},
    '26' : {'code':'Nakhon Nayok','name':'Nakhon Nayok'},
    '27' : {'code':'Nakhon Pathom','name':'Nakhon Pathom'},
    '28' : {'code':'Nakhon Phanom','name':'Nakhon Phanom'},
    '29' : {'code':'Nakhon Ratchasima','name':'Nakhon Ratchasima'},
    '30' : {'code':'Nakhon Sawan','name':'Nakhon Sawan'},
    '31' : {'code':'Nakhon Si Thammarat','name':'Nakhon Si Thammarat'},
    '32' : {'code':'Nan','name':'Nan'},
    '33' : {'code':'Narathiwat','name':'Narathiwat'},
    '34' : {'code':'Nong Bua Lamphu','name':'Nong Bua Lamphu'},
    '35' : {'code':'Nong Khai','name':'Nong Khai'},
    '36' : {'code':'Nonthaburi','name':'Nonthaburi'},
    '37' : {'code':'Pathum Thani','name':'Pathum Thani'},
    '38' : {'code':'Pattani','name':'Pattani'},
    '39' : {'code':'Phangnga','name':'Phangnga'},
    '40' : {'code':'Phatthalung','name':'Phatthalung'},
    '41' : {'code':'Phayao','name':'Phayao'},
    '42' : {'code':'Phetchabun','name':'Phetchabun'},
    '43' : {'code':'Phetchaburi','name':'Phetchaburi'},
    '44' : {'code':'Phichit','name':'Phichit'},
    '45' : {'code':'Phitsanulok','name':'Phitsanulok'},
    '46' : {'code':'Phrae','name':'Phrae'},
    '47' : {'code':'Phuket','name':'Phuket'},
    '48' : {'code':'Prachin Buri','name':'Prachin Buri'},
    '49' : {'code':'Prachuap Khiri Khan','name':'Prachuap Khiri Khan'},
    '50' : {'code':'Ranong','name':'Ranong'},
    '51' : {'code':'Ratchaburi','name':'Ratchaburi'},
    '52' : {'code':'Rayong','name':'Rayong'},
    '53' : {'code':'Roi Et','name':'Roi Et'},
    '54' : {'code':'Sa Kaeo','name':'Sa Kaeo'},
    '55' : {'code':'Sakon Nakhon','name':'Sakon Nakhon'},
    '56' : {'code':'Samut Prakan','name':'Samut Prakan'},
    '57' : {'code':'Samut Sakhon','name':'Samut Sakhon'},
    '58' : {'code':'Samut Songkhram','name':'Samut Songkhram'},
    '59' : {'code':'Sara Buri','name':'Sara Buri'},
    '60' : {'code':'Satun','name':'Satun'},
    '61' : {'code':'Sing Buri','name':'Sing Buri'},
    '62' : {'code':'Sisaket','name':'Sisaket'},
    '63' : {'code':'Songkhla','name':'Songkhla'},
    '64' : {'code':'Sukhothai','name':'Sukhothai'},
    '65' : {'code':'Suphan Buri','name':'Suphan Buri'},
    '66' : {'code':'Surat Thani','name':'Surat Thani'},
    '67' : {'code':'Surin','name':'Surin'},
    '68' : {'code':'Tak','name':'Tak'},
    '69' : {'code':'Trang','name':'Trang'},
    '70' : {'code':'Trat','name':'Trat'},
    '71' : {'code':'Ubon Ratchathani','name':'Ubon Ratchathani'},
    '72' : {'code':'Udon Thani','name':'Udon Thani'},
    '73' : {'code':'Uthai Thani','name':'Uthai Thani'},
    '74' : {'code':'Uttaradit','name':'Uttaradit'},
    '75' : {'code':'Yala','name':'Yala'},
    '76' : {'code':'Yasothon','name':'Yasothon'}
  },
  'TG':{
    '1' : {'code':'K','name':'Kara'},
    '2' : {'code':'P','name':'Plateaux'},
    '3' : {'code':'S','name':'Savanes'},
    '4' : {'code':'C','name':'Centrale'},
    '5' : {'code':'M','name':'Maritime'}
  },
  'TK':{
    '1' : {'code':'A','name':'Atafu'},
    '2' : {'code':'F','name':'Fakaofo'},
    '3' : {'code':'N','name':'Nukunonu'}
  },
  'TO':{
    '1' : {'code':'H','name':'Ha\'apai'},
    '2' : {'code':'T','name':'Tongatapu'},
    '3' : {'code':'V','name':'Vava\'u'}
  },
  'TT':{
    '1' : {'code':'CT','name':'Couva/Tabaquite/Talparo'},
    '2' : {'code':'DM','name':'Diego Martin'},
    '3' : {'code':'MR','name':'Mayaro/Rio Claro'},
    '4' : {'code':'PD','name':'Penal/Debe'},
    '5' : {'code':'PT','name':'Princes Town'},
    '6' : {'code':'SG','name':'Sangre Grande'},
    '7' : {'code':'SL','name':'San Juan/Laventille'},
    '8' : {'code':'SI','name':'Siparia'},
    '9' : {'code':'TP','name':'Tunapuna/Piarco'},
    '10' : {'code':'PS','name':'Port of Spain'},
    '11' : {'code':'SF','name':'San Fernando'},
    '12' : {'code':'AR','name':'Arima'},
    '13' : {'code':'PF','name':'Point Fortin'},
    '14' : {'code':'CH','name':'Chaguanas'},
    '15' : {'code':'TO','name':'Tobago'}
  },
  'TN':{
    '1' : {'code':'AR','name':'Ariana'},
    '2' : {'code':'BJ','name':'Beja'},
    '3' : {'code':'BA','name':'Ben Arous'},
    '4' : {'code':'BI','name':'Bizerte'},
    '5' : {'code':'GB','name':'Gabes'},
    '6' : {'code':'GF','name':'Gafsa'},
    '7' : {'code':'JE','name':'Jendouba'},
    '8' : {'code':'KR','name':'Kairouan'},
    '9' : {'code':'KS','name':'Kasserine'},
    '10' : {'code':'KB','name':'Kebili'},
    '11' : {'code':'KF','name':'Kef'},
    '12' : {'code':'MH','name':'Mahdia'},
    '13' : {'code':'MN','name':'Manouba'},
    '14' : {'code':'ME','name':'Medenine'},
    '15' : {'code':'MO','name':'Monastir'},
    '16' : {'code':'NA','name':'Nabeul'},
    '17' : {'code':'SF','name':'Sfax'},
    '18' : {'code':'SD','name':'Sidi'},
    '19' : {'code':'SL','name':'Siliana'},
    '20' : {'code':'SO','name':'Sousse'},
    '21' : {'code':'TA','name':'Tataouine'},
    '22' : {'code':'TO','name':'Tozeur'},
    '23' : {'code':'TU','name':'Tunis'},
    '24' : {'code':'ZA','name':'Zaghouan'}
  },
  'TR':{
    '1' : {'code':'ADA','name':'Adana'},
    '2' : {'code':'ADI','name':'Adiyaman'},
    '3' : {'code':'AFY','name':'Afyonkarahisar'},
    '4' : {'code':'AGR','name':'Agri'},
    '5' : {'code':'AKS','name':'Aksaray'},
    '6' : {'code':'AMA','name':'Amasya'},
    '7' : {'code':'ANK','name':'Ankara'},
    '8' : {'code':'ANT','name':'Antalya'},
    '9' : {'code':'ARD','name':'Ardahan'},
    '10' : {'code':'ART','name':'Artvin'},
    '11' : {'code':'AYI','name':'Aydin'},
    '12' : {'code':'BAL','name':'Balikesir'},
    '13' : {'code':'BAR','name':'Bartin'},
    '14' : {'code':'BAT','name':'Batman'},
    '15' : {'code':'BAY','name':'Bayburt'},
    '16' : {'code':'BIL','name':'Bilecik'},
    '17' : {'code':'BIN','name':'Bingol'},
    '18' : {'code':'BIT','name':'Bitlis'},
    '19' : {'code':'BOL','name':'Bolu'},
    '20' : {'code':'BRD','name':'Burdur'},
    '21' : {'code':'BRS','name':'Bursa'},
    '22' : {'code':'CKL','name':'Canakkale'},
    '23' : {'code':'CKR','name':'Cankiri'},
    '24' : {'code':'COR','name':'Corum'},
    '25' : {'code':'DEN','name':'Denizli'},
    '26' : {'code':'DIY','name':'Diyarbakir'},
    '27' : {'code':'DUZ','name':'Duzce'},
    '28' : {'code':'EDI','name':'Edirne'},
    '29' : {'code':'ELA','name':'Elazig'},
    '30' : {'code':'EZC','name':'Erzincan'},
    '31' : {'code':'EZR','name':'Erzurum'},
    '32' : {'code':'ESK','name':'Eskisehir'},
    '33' : {'code':'GAZ','name':'Gaziantep'},
    '34' : {'code':'GIR','name':'Giresun'},
    '35' : {'code':'GMS','name':'Gumushane'},
    '36' : {'code':'HKR','name':'Hakkari'},
    '37' : {'code':'HTY','name':'Hatay'},
    '38' : {'code':'IGD','name':'Igdir'},
    '39' : {'code':'ISP','name':'Isparta'},
    '40' : {'code':'IST','name':'Istanbul'},
    '41' : {'code':'IZM','name':'Izmir'},
    '42' : {'code':'KAH','name':'Kahramanmaras'},
    '43' : {'code':'KRB','name':'Karabuk'},
    '44' : {'code':'KRM','name':'Karaman'},
    '45' : {'code':'KRS','name':'Kars'},
    '46' : {'code':'KAS','name':'Kastamonu'},
    '47' : {'code':'KAY','name':'Kayseri'},
    '48' : {'code':'KLS','name':'Kilis'},
    '49' : {'code':'KRK','name':'Kirikkale'},
    '50' : {'code':'KLR','name':'Kirklareli'},
    '51' : {'code':'KRH','name':'Kirsehir'},
    '52' : {'code':'KOC','name':'Kocaeli'},
    '53' : {'code':'KON','name':'Konya'},
    '54' : {'code':'KUT','name':'Kutahya'},
    '55' : {'code':'MAL','name':'Malatya'},
    '56' : {'code':'MAN','name':'Manisa'},
    '57' : {'code':'MAR','name':'Mardin'},
    '58' : {'code':'MER','name':'Mersin'},
    '59' : {'code':'MUG','name':'Mugla'},
    '60' : {'code':'MUS','name':'Mus'},
    '61' : {'code':'NEV','name':'Nevsehir'},
    '62' : {'code':'NIG','name':'Nigde'},
    '63' : {'code':'ORD','name':'Ordu'},
    '64' : {'code':'OSM','name':'Osmaniye'},
    '65' : {'code':'RIZ','name':'Rize'},
    '66' : {'code':'SAK','name':'Sakarya'},
    '67' : {'code':'SAM','name':'Samsun'},
    '68' : {'code':'SAN','name':'Sanliurfa'},
    '69' : {'code':'SII','name':'Siirt'},
    '70' : {'code':'SIN','name':'Sinop'},
    '71' : {'code':'SIR','name':'Sirnak'},
    '72' : {'code':'SIV','name':'Sivas'},
    '73' : {'code':'TEL','name':'Tekirdag'},
    '74' : {'code':'TOK','name':'Tokat'},
    '75' : {'code':'TRA','name':'Trabzon'},
    '76' : {'code':'TUN','name':'Tunceli'},
    '77' : {'code':'USK','name':'Usak'},
    '78' : {'code':'VAN','name':'Van'},
    '79' : {'code':'YAL','name':'Yalova'},
    '80' : {'code':'YOZ','name':'Yozgat'},
    '81' : {'code':'ZON','name':'Zonguldak'}
  },
  'TM':{
    '1' : {'code':'A','name':'Ahal Welayaty'},
    '2' : {'code':'B','name':'Balkan Welayaty'},
    '3' : {'code':'D','name':'Dashhowuz Welayaty'},
    '4' : {'code':'L','name':'Lebap Welayaty'},
    '5' : {'code':'M','name':'Mary Welayaty'}
  },
  'TC':{
    '1' : {'code':'AC','name':'Ambergris Cays'},
    '2' : {'code':'DC','name':'Dellis Cay'},
    '3' : {'code':'FC','name':'French Cay'},
    '4' : {'code':'LW','name':'Little Water Cay'},
    '5' : {'code':'RC','name':'Parrot Cay'},
    '6' : {'code':'PN','name':'Pine Cay'},
    '7' : {'code':'SL','name':'Salt Cay'},
    '8' : {'code':'GT','name':'Grand Turk'},
    '9' : {'code':'SC','name':'South Caicos'},
    '10' : {'code':'EC','name':'East Caicos'},
    '11' : {'code':'MC','name':'Middle Caicos'},
    '12' : {'code':'NC','name':'North Caicos'},
    '13' : {'code':'PR','name':'Providenciales'},
    '14' : {'code':'WC','name':'West Caicos'}
  },
  'TV':{
    '1' : {'code':'NMG','name':'Nanumanga'},
    '2' : {'code':'NLK','name':'Niulakita'},
    '3' : {'code':'NTO','name':'Niutao'},
    '4' : {'code':'FUN','name':'Funafuti'},
    '5' : {'code':'NME','name':'Nanumea'},
    '6' : {'code':'NUI','name':'Nui'},
    '7' : {'code':'NFT','name':'Nukufetau'},
    '8' : {'code':'NLL','name':'Nukulaelae'},
    '9' : {'code':'VAI','name':'Vaitupu'}
  },
  'UG':{
    '1' : {'code':'KAL','name':'Kalangala'},
    '2' : {'code':'KMP','name':'Kampala'},
    '3' : {'code':'KAY','name':'Kayunga'},
    '4' : {'code':'KIB','name':'Kiboga'},
    '5' : {'code':'LUW','name':'Luwero'},
    '6' : {'code':'MAS','name':'Masaka'},
    '7' : {'code':'MPI','name':'Mpigi'},
    '8' : {'code':'MUB','name':'Mubende'},
    '9' : {'code':'MUK','name':'Mukono'},
    '10' : {'code':'NKS','name':'Nakasongola'},
    '11' : {'code':'RAK','name':'Rakai'},
    '12' : {'code':'SEM','name':'Sembabule'},
    '13' : {'code':'WAK','name':'Wakiso'},
    '14' : {'code':'BUG','name':'Bugiri'},
    '15' : {'code':'BUS','name':'Busia'},
    '16' : {'code':'IGA','name':'Iganga'},
    '17' : {'code':'JIN','name':'Jinja'},
    '18' : {'code':'KAB','name':'Kaberamaido'},
    '19' : {'code':'KML','name':'Kamuli'},
    '20' : {'code':'KPC','name':'Kapchorwa'},
    '21' : {'code':'KTK','name':'Katakwi'},
    '22' : {'code':'KUM','name':'Kumi'},
    '23' : {'code':'MAY','name':'Mayuge'},
    '24' : {'code':'MBA','name':'Mbale'},
    '25' : {'code':'PAL','name':'Pallisa'},
    '26' : {'code':'SIR','name':'Sironko'},
    '27' : {'code':'SOR','name':'Soroti'},
    '28' : {'code':'TOR','name':'Tororo'},
    '29' : {'code':'ADJ','name':'Adjumani'},
    '30' : {'code':'APC','name':'Apac'},
    '31' : {'code':'ARU','name':'Arua'},
    '32' : {'code':'GUL','name':'Gulu'},
    '33' : {'code':'KIT','name':'Kitgum'},
    '34' : {'code':'KOT','name':'Kotido'},
    '35' : {'code':'LIR','name':'Lira'},
    '36' : {'code':'MRT','name':'Moroto'},
    '37' : {'code':'MOY','name':'Moyo'},
    '38' : {'code':'NAK','name':'Nakapiripirit'},
    '39' : {'code':'NEB','name':'Nebbi'},
    '40' : {'code':'PAD','name':'Pader'},
    '41' : {'code':'YUM','name':'Yumbe'},
    '42' : {'code':'BUN','name':'Bundibugyo'},
    '43' : {'code':'BSH','name':'Bushenyi'},
    '44' : {'code':'HOI','name':'Hoima'},
    '45' : {'code':'KBL','name':'Kabale'},
    '46' : {'code':'KAR','name':'Kabarole'},
    '47' : {'code':'KAM','name':'Kamwenge'},
    '48' : {'code':'KAN','name':'Kanungu'},
    '49' : {'code':'KAS','name':'Kasese'},
    '50' : {'code':'KBA','name':'Kibaale'},
    '51' : {'code':'KIS','name':'Kisoro'},
    '52' : {'code':'KYE','name':'Kyenjojo'},
    '53' : {'code':'MSN','name':'Masindi'},
    '54' : {'code':'MBR','name':'Mbarara'},
    '55' : {'code':'NTU','name':'Ntungamo'},
    '56' : {'code':'RUK','name':'Rukungiri'}
  },
  'UA':{
    '1' : {'code':'CK','name':'Cherkasy'},
    '2' : {'code':'CH','name':'Chernihiv'},
    '3' : {'code':'CV','name':'Chernivtsi'},
    '4' : {'code':'CR','name':'Crimea'},
    '5' : {'code':'DN','name':'Dnipropetrovs\'k'},
    '6' : {'code':'DO','name':'Donets\'k'},
    '7' : {'code':'IV','name':'Ivano-Frankivs\'k'},
    '8' : {'code':'KL','name':'Kharkiv Kherson'},
    '9' : {'code':'KM','name':'Khmel\'nyts\'kyy'},
    '10' : {'code':'KR','name':'Kirovohrad'},
    '11' : {'code':'KV','name':'Kiev'},
    '12' : {'code':'KY','name':'Kyyiv'},
    '13' : {'code':'LU','name':'Luhans\'k'},
    '14' : {'code':'LV','name':'L\'viv'},
    '15' : {'code':'MY','name':'Mykolayiv'},
    '16' : {'code':'OD','name':'Odesa'},
    '17' : {'code':'PO','name':'Poltava'},
    '18' : {'code':'RI','name':'Rivne'},
    '19' : {'code':'SE','name':'Sevastopol'},
    '20' : {'code':'SU','name':'Sumy'},
    '21' : {'code':'TE','name':'Ternopil\''},
    '22' : {'code':'VI','name':'Vinnytsya'},
    '23' : {'code':'VO','name':'Volyn\''},
    '24' : {'code':'ZK','name':'Zakarpattya'},
    '25' : {'code':'ZA','name':'Zaporizhzhya'},
    '26' : {'code':'ZH','name':'Zhytomyr'}
  },
  'AE':{
    '1' : {'code':'AZ','name':'Abu Zaby'},
    '2' : {'code':'AJ','name':'\'Ajman'},
    '3' : {'code':'FU','name':'Al Fujayrah'},
    '4' : {'code':'SH','name':'Ash Shariqah'},
    '5' : {'code':'DU','name':'Dubayy'},
    '6' : {'code':'RK','name':'R\'as al Khaymah'},
    '7' : {'code':'UQ','name':'Umm al Qaywayn'}
  },
  'GB':{
    '1' : {'code':'ABN','name':'Aberdeen'},
    '2' : {'code':'ABNS','name':'Aberdeenshire'},
    '3' : {'code':'ANG','name':'Anglesey'},
    '4' : {'code':'AGS','name':'Angus'},
    '5' : {'code':'ARY','name':'Argyll and Bute'},
    '6' : {'code':'BEDS','name':'Bedfordshire'},
    '7' : {'code':'BERKS','name':'Berkshire'},
    '8' : {'code':'BLA','name':'Blaenau Gwent'},
    '9' : {'code':'BRI','name':'Bridgend'},
    '10' : {'code':'BSTL','name':'Bristol'},
    '11' : {'code':'BUCKS','name':'Buckinghamshire'},
    '12' : {'code':'CAE','name':'Caerphilly'},
    '13' : {'code':'CAMBS','name':'Cambridgeshire'},
    '14' : {'code':'CDF','name':'Cardiff'},
    '15' : {'code':'CARM','name':'Carmarthenshire'},
    '16' : {'code':'CDGN','name':'Ceredigion'},
    '17' : {'code':'CHES','name':'Cheshire'},
    '18' : {'code':'CLACK','name':'Clackmannanshire'},
    '19' : {'code':'CON','name':'Conwy'},
    '20' : {'code':'CORN','name':'Cornwall'},
    '21' : {'code':'DNBG','name':'Denbighshire'},
    '22' : {'code':'DERBY','name':'Derbyshire'},
    '23' : {'code':'DVN','name':'Devon'},
    '24' : {'code':'DOR','name':'Dorset'},
    '25' : {'code':'DGL','name':'Dumfries and Galloway'},
    '26' : {'code':'DUND','name':'Dundee'},
    '27' : {'code':'DHM','name':'Durham'},
    '28' : {'code':'ARYE','name':'East Ayrshire'},
    '29' : {'code':'DUNBE','name':'East Dunbartonshire'},
    '30' : {'code':'LOTE','name':'East Lothian'},
    '31' : {'code':'RENE','name':'East Renfrewshire'},
    '32' : {'code':'ERYS','name':'East Riding of Yorkshire'},
    '33' : {'code':'SXE','name':'East Sussex'},
    '34' : {'code':'EDIN','name':'Edinburgh'},
    '35' : {'code':'ESX','name':'Essex'},
    '36' : {'code':'FALK','name':'Falkirk'},
    '37' : {'code':'FFE','name':'Fife'},
    '38' : {'code':'FLINT','name':'Flintshire'},
    '39' : {'code':'GLAS','name':'Glasgow'},
    '40' : {'code':'GLOS','name':'Gloucestershire'},
    '41' : {'code':'LDN','name':'Greater London'},
    '42' : {'code':'MCH','name':'Greater Manchester'},
    '43' : {'code':'GDD','name':'Gwynedd'},
    '44' : {'code':'HANTS','name':'Hampshire'},
    '45' : {'code':'HWR','name':'Herefordshire'},
    '46' : {'code':'HERTS','name':'Hertfordshire'},
    '47' : {'code':'HLD','name':'Highlands'},
    '48' : {'code':'IVER','name':'Inverclyde'},
    '49' : {'code':'IOW','name':'Isle of Wight'},
    '50' : {'code':'KNT','name':'Kent'},
    '51' : {'code':'LANCS','name':'Lancashire'},
    '52' : {'code':'LEICS','name':'Leicestershire'},
    '53' : {'code':'LINCS','name':'Lincolnshire'},
    '54' : {'code':'MSY','name':'Merseyside'},
    '55' : {'code':'MERT','name':'Merthyr Tydfil'},
    '56' : {'code':'MLOT','name':'Midlothian'},
    '57' : {'code':'MMOUTH','name':'Monmouthshire'},
    '58' : {'code':'MORAY','name':'Moray'},
    '59' : {'code':'NPRTAL','name':'Neath Port Talbot'},
    '60' : {'code':'NEWPT','name':'Newport'},
    '61' : {'code':'NOR','name':'Norfolk'},
    '62' : {'code':'ARYN','name':'North Ayrshire'},
    '63' : {'code':'LANN','name':'North Lanarkshire'},
    '64' : {'code':'YSN','name':'North Yorkshire'},
    '65' : {'code':'NHM','name':'Northamptonshire'},
    '66' : {'code':'NLD','name':'Northumberland'},
    '67' : {'code':'NOT','name':'Nottinghamshire'},
    '68' : {'code':'ORK','name':'Orkney Islands'},
    '69' : {'code':'OFE','name':'Oxfordshire'},
    '70' : {'code':'PEM','name':'Pembrokeshire'},
    '71' : {'code':'PERTH','name':'Perth and Kinross'},
    '72' : {'code':'PWS','name':'Powys'},
    '73' : {'code':'REN','name':'Renfrewshire'},
    '74' : {'code':'RHON','name':'Rhondda Cynon Taff'},
    '75' : {'code':'RUT','name':'Rutland'},
    '76' : {'code':'BOR','name':'Scottish Borders'},
    '77' : {'code':'SHET','name':'Shetland Islands'},
    '78' : {'code':'SPE','name':'Shropshire'},
    '79' : {'code':'SOM','name':'Somerset'},
    '80' : {'code':'ARYS','name':'South Ayrshire'},
    '81' : {'code':'LANS','name':'South Lanarkshire'},
    '82' : {'code':'YSS','name':'South Yorkshire'},
    '83' : {'code':'SFD','name':'Staffordshire'},
    '84' : {'code':'STIR','name':'Stirling'},
    '85' : {'code':'SFK','name':'Suffolk'},
    '86' : {'code':'SRY','name':'Surrey'},
    '87' : {'code':'SWAN','name':'Swansea'},
    '88' : {'code':'TORF','name':'Torfaen'},
    '89' : {'code':'TWR','name':'Tyne and Wear'},
    '90' : {'code':'VGLAM','name':'Vale of Glamorgan'},
    '91' : {'code':'WARKS','name':'Warwickshire'},
    '92' : {'code':'WDUN','name':'West Dunbartonshire'},
    '93' : {'code':'WLOT','name':'West Lothian'},
    '94' : {'code':'WMD','name':'West Midlands'},
    '95' : {'code':'SXW','name':'West Sussex'},
    '96' : {'code':'YSW','name':'West Yorkshire'},
    '97' : {'code':'WIL','name':'Western Isles'},
    '98' : {'code':'WLT','name':'Wiltshire'},
    '99' : {'code':'WORCS','name':'Worcestershire'},
    '100' : {'code':'WRX','name':'Wrexham'}
  },
  'US':{
    '1' : {'code':'AL','name':'Alabama'},
    '2' : {'code':'AK','name':'Alaska'},
    '3' : {'code':'AS','name':'American Samoa'},
    '4' : {'code':'AZ','name':'Arizona'},
    '5' : {'code':'AR','name':'Arkansas'},
    '6' : {'code':'AF','name':'Armed Forces Africa'},
    '7' : {'code':'AA','name':'Armed Forces Americas'},
    '8' : {'code':'AC','name':'Armed Forces Canada'},
    '9' : {'code':'AE','name':'Armed Forces Europe'},
    '10' : {'code':'AM','name':'Armed Forces Middle East'},
    '11' : {'code':'AP','name':'Armed Forces Pacific'},
    '12' : {'code':'CA','name':'California'},
    '13' : {'code':'CO','name':'Colorado'},
    '14' : {'code':'CT','name':'Connecticut'},
    '15' : {'code':'DE','name':'Delaware'},
    '16' : {'code':'DC','name':'District of Columbia'},
    '17' : {'code':'FM','name':'Federated States Of Micronesia'},
    '18' : {'code':'FL','name':'Florida'},
    '19' : {'code':'GA','name':'Georgia'},
    '20' : {'code':'GU','name':'Guam'},
    '21' : {'code':'HI','name':'Hawaii'},
    '22' : {'code':'ID','name':'Idaho'},
    '23' : {'code':'IL','name':'Illinois'},
    '24' : {'code':'IN','name':'Indiana'},
    '25' : {'code':'IA','name':'Iowa'},
    '26' : {'code':'KS','name':'Kansas'},
    '27' : {'code':'KY','name':'Kentucky'},
    '28' : {'code':'LA','name':'Louisiana'},
    '29' : {'code':'ME','name':'Maine'},
    '30' : {'code':'MH','name':'Marshall Islands'},
    '31' : {'code':'MD','name':'Maryland'},
    '32' : {'code':'MA','name':'Massachusetts'},
    '33' : {'code':'MI','name':'Michigan'},
    '34' : {'code':'MN','name':'Minnesota'},
    '35' : {'code':'MS','name':'Mississippi'},
    '36' : {'code':'MO','name':'Missouri'},
    '37' : {'code':'MT','name':'Montana'},
    '38' : {'code':'NE','name':'Nebraska'},
    '39' : {'code':'NV','name':'Nevada'},
    '40' : {'code':'NH','name':'New Hampshire'},
    '41' : {'code':'NJ','name':'New Jersey'},
    '42' : {'code':'NM','name':'New Mexico'},
    '43' : {'code':'NY','name':'New York'},
    '44' : {'code':'NC','name':'North Carolina'},
    '45' : {'code':'ND','name':'North Dakota'},
    '46' : {'code':'MP','name':'Northern Mariana Islands'},
    '47' : {'code':'OH','name':'Ohio'},
    '48' : {'code':'OK','name':'Oklahoma'},
    '49' : {'code':'OR','name':'Oregon'},
    '50' : {'code':'PW','name':'Palau'},
    '51' : {'code':'PA','name':'Pennsylvania'},
    '52' : {'code':'PR','name':'Puerto Rico'},
    '53' : {'code':'RI','name':'Rhode Island'},
    '54' : {'code':'SC','name':'South Carolina'},
    '55' : {'code':'SD','name':'South Dakota'},
    '56' : {'code':'TN','name':'Tennessee'},
    '57' : {'code':'TX','name':'Texas'},
    '58' : {'code':'UT','name':'Utah'},
    '59' : {'code':'VT','name':'Vermont'},
    '60' : {'code':'VI','name':'Virgin Islands'},
    '61' : {'code':'VA','name':'Virginia'},
    '62' : {'code':'WA','name':'Washington'},
    '63' : {'code':'WV','name':'West Virginia'},
    '64' : {'code':'WI','name':'Wisconsin'},
    '65' : {'code':'WY','name':'Wyoming'}
  },
  'UM':{
    '1' : {'code':'BI','name':'Baker Island'},
    '2' : {'code':'HI','name':'Howland Island'},
    '3' : {'code':'JI','name':'Jarvis Island'},
    '4' : {'code':'JA','name':'Johnston Atoll'},
    '5' : {'code':'KR','name':'Kingman Reef'},
    '6' : {'code':'MA','name':'Midway Atoll'},
    '7' : {'code':'NI','name':'Navassa Island'},
    '8' : {'code':'PA','name':'Palmyra Atoll'},
    '9' : {'code':'WI','name':'Wake Island'}
  },
  'UY':{
    '1' : {'code':'AR','name':'Artigas'},
    '2' : {'code':'CA','name':'Canelones'},
    '3' : {'code':'CL','name':'Cerro Largo'},
    '4' : {'code':'CO','name':'Colonia'},
    '5' : {'code':'DU','name':'Durazno'},
    '6' : {'code':'FS','name':'Flores'},
    '7' : {'code':'FA','name':'Florida'},
    '8' : {'code':'LA','name':'Lavalleja'},
    '9' : {'code':'MA','name':'Maldonado'},
    '10' : {'code':'MO','name':'Montevideo'},
    '11' : {'code':'PA','name':'Paysandu'},
    '12' : {'code':'RN','name':'Rio Negro'},
    '13' : {'code':'RV','name':'Rivera'},
    '14' : {'code':'RO','name':'Rocha'},
    '15' : {'code':'SL','name':'Salto'},
    '16' : {'code':'SJ','name':'San Jose'},
    '17' : {'code':'SO','name':'Soriano'},
    '18' : {'code':'TA','name':'Tacuarembo'},
    '19' : {'code':'TT','name':'Treinta y Tres'}
  },
  'UZ':{
    '1' : {'code':'AN','name':'Andijon'},
    '2' : {'code':'BU','name':'Buxoro'},
    '3' : {'code':'FA','name':'Farg\'ona'},
    '4' : {'code':'JI','name':'Jizzax'},
    '5' : {'code':'NG','name':'Namangan'},
    '6' : {'code':'NW','name':'Navoiy'},
    '7' : {'code':'QA','name':'Qashqadaryo'},
    '8' : {'code':'QR','name':'Qoraqalpog\'iston Republikasi'},
    '9' : {'code':'SA','name':'Samarqand'},
    '10' : {'code':'SI','name':'Sirdaryo'},
    '11' : {'code':'SU','name':'Surxondaryo'},
    '12' : {'code':'TK','name':'Toshkent City'},
    '13' : {'code':'TO','name':'Toshkent Region'},
    '14' : {'code':'XO','name':'Xorazm'}
  },
  'VU':{
    '1' : {'code':'MA','name':'Malampa'},
    '2' : {'code':'PE','name':'Penama'},
    '3' : {'code':'SA','name':'Sanma'},
    '4' : {'code':'SH','name':'Shefa'},
    '5' : {'code':'TA','name':'Tafea'},
    '6' : {'code':'TO','name':'Torba'}
  },
  'VE':{
    '1' : {'code':'AM','name':'Amazonas'},
    '2' : {'code':'AN','name':'Anzoategui'},
    '3' : {'code':'AP','name':'Apure'},
    '4' : {'code':'AR','name':'Aragua'},
    '5' : {'code':'BA','name':'Barinas'},
    '6' : {'code':'BO','name':'Bolivar'},
    '7' : {'code':'CA','name':'Carabobo'},
    '8' : {'code':'CO','name':'Cojedes'},
    '9' : {'code':'DA','name':'Delta Amacuro'},
    '10' : {'code':'DF','name':'Dependencias Federales'},
    '11' : {'code':'DI','name':'Distrito Federal'},
    '12' : {'code':'FA','name':'Falcon'},
    '13' : {'code':'GU','name':'Guarico'},
    '14' : {'code':'LA','name':'Lara'},
    '15' : {'code':'ME','name':'Merida'},
    '16' : {'code':'MI','name':'Miranda'},
    '17' : {'code':'MO','name':'Monagas'},
    '18' : {'code':'NE','name':'Nueva Esparta'},
    '19' : {'code':'PO','name':'Portuguesa'},
    '20' : {'code':'SU','name':'Sucre'},
    '21' : {'code':'TA','name':'Tachira'},
    '22' : {'code':'TR','name':'Trujillo'},
    '23' : {'code':'VA','name':'Vargas'},
    '24' : {'code':'YA','name':'Yaracuy'},
    '25' : {'code':'ZU','name':'Zulia'}
  },
  'VN':{
    '1' : {'code':'AG','name':'An Giang'},
    '2' : {'code':'BG','name':'Bac Giang'},
    '3' : {'code':'BK','name':'Bac Kan'},
    '4' : {'code':'BL','name':'Bac Lieu'},
    '5' : {'code':'BC','name':'Bac Ninh'},
    '6' : {'code':'BR','name':'Ba Ria-Vung Tau'},
    '7' : {'code':'BN','name':'Ben Tre'},
    '8' : {'code':'BH','name':'Binh Dinh'},
    '9' : {'code':'BU','name':'Binh Duong'},
    '10' : {'code':'BP','name':'Binh Phuoc'},
    '11' : {'code':'BT','name':'Binh Thuan'},
    '12' : {'code':'CM','name':'Ca Mau'},
    '13' : {'code':'CT','name':'Can Tho'},
    '14' : {'code':'CB','name':'Cao Bang'},
    '15' : {'code':'DL','name':'Dak Lak'},
    '16' : {'code':'DG','name':'Dak Nong'},
    '17' : {'code':'DN','name':'Da Nang'},
    '18' : {'code':'DB','name':'Dien Bien'},
    '19' : {'code':'DI','name':'Dong Nai'},
    '20' : {'code':'DT','name':'Dong Thap'},
    '21' : {'code':'GL','name':'Gia Lai'},
    '22' : {'code':'HG','name':'Ha Giang'},
    '23' : {'code':'HD','name':'Hai Duong'},
    '24' : {'code':'HP','name':'Hai Phong'},
    '25' : {'code':'HM','name':'Ha Nam'},
    '26' : {'code':'HI','name':'Ha Noi'},
    '27' : {'code':'HT','name':'Ha Tay'},
    '28' : {'code':'HH','name':'Ha Tinh'},
    '29' : {'code':'HB','name':'Hoa Binh'},
    '30' : {'code':'HC','name':'Ho Chin Minh'},
    '31' : {'code':'HU','name':'Hau Giang'},
    '32' : {'code':'HY','name':'Hung Yen'}
  },
  'VI':{
    '1' : {'code':'C','name':'Saint Croix'},
    '2' : {'code':'J','name':'Saint John'},
    '3' : {'code':'T','name':'Saint Thomas'}
  },
  'WF':{
    '1' : {'code':'A','name':'Alo'},
    '2' : {'code':'S','name':'Sigave'},
    '3' : {'code':'W','name':'Wallis'}
  },
  'YE':{
    '1' : {'code':'AB','name':'Abyan'},
    '2' : {'code':'AD','name':'Adan'},
    '3' : {'code':'AM','name':'Amran'},
    '4' : {'code':'BA','name':'Al Bayda'},
    '5' : {'code':'DA','name':'Ad Dali'},
    '6' : {'code':'DH','name':'Dhamar'},
    '7' : {'code':'HD','name':'Hadramawt'},
    '8' : {'code':'HJ','name':'Hajjah'},
    '9' : {'code':'HU','name':'Al Hudaydah'},
    '10' : {'code':'IB','name':'Ibb'},
    '11' : {'code':'JA','name':'Al Jawf'},
    '12' : {'code':'LA','name':'Lahij'},
    '13' : {'code':'MA','name':'Ma\'rib'},
    '14' : {'code':'MR','name':'Al Mahrah'},
    '15' : {'code':'MW','name':'Al Mahwit'},
    '16' : {'code':'SD','name':'Sa\'dah'},
    '17' : {'code':'SN','name':'San\'a'},
    '18' : {'code':'SH','name':'Shabwah'},
    '19' : {'code':'TA','name':'Ta\'izz'}
  },
  'YU':{
    '1' : {'code':'KOS','name':'Kosovo'},
    '2' : {'code':'MON','name':'Montenegro'},
    '3' : {'code':'SER','name':'Serbia'},
    '4' : {'code':'VOJ','name':'Vojvodina'}
  },
  'ZR':{
    '1' : {'code':'BC','name':'Bas-Congo'},
    '2' : {'code':'BN','name':'Bandundu'},
    '3' : {'code':'EQ','name':'Equateur'},
    '4' : {'code':'KA','name':'Katanga'},
    '5' : {'code':'KE','name':'Kasai-Oriental'},
    '6' : {'code':'KN','name':'Kinshasa'},
    '7' : {'code':'KW','name':'Kasai-Occidental'},
    '8' : {'code':'MA','name':'Maniema'},
    '9' : {'code':'NK','name':'Nord-Kivu'},
    '10' : {'code':'OR','name':'Orientale'},
    '11' : {'code':'SK','name':'Sud-Kivu'}
  },
  'ZM':{
    '1' : {'code':'CE','name':'Central'},
    '2' : {'code':'CB','name':'Copperbelt'},
    '3' : {'code':'EA','name':'Eastern'},
    '4' : {'code':'LP','name':'Luapula'},
    '5' : {'code':'LK','name':'Lusaka'},
    '6' : {'code':'NO','name':'Northern'},
    '7' : {'code':'NW','name':'North-Western'},
    '8' : {'code':'SO','name':'Southern'},
    '9' : {'code':'WE','name':'Western'}
  },
  'ZW':{
    '1' : {'code':'BU','name':'Bulawayo'},
    '2' : {'code':'HA','name':'Harare'},
    '3' : {'code':'ML','name':'Manicaland'},
    '4' : {'code':'MC','name':'Mashonaland Central'},
    '5' : {'code':'ME','name':'Mashonaland East'},
    '6' : {'code':'MW','name':'Mashonaland West'},
    '7' : {'code':'MV','name':'Masvingo'},
    '8' : {'code':'MN','name':'Matabeleland North'},
    '9' : {'code':'MS','name':'Matabeleland South'},
    '10' : {'code':'MD','name':'Midlands'}
  }
};

/* ==========================================================
 * bootstrap-formhelpers-timepicker.en_US.js
 * https://github.com/vlamanna/BootstrapFormHelpers
 * ==========================================================
 * Copyright 2012 Vincent Lamanna
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */
 
var BFHTimePickerDelimiter = ':';

var BFHTimePickerModes = {
  'am': 'AM',
  'pm': 'PM'
};
/* ==========================================================
 * bootstrap-formhelpers-timezones.en_US.js
 * https://github.com/vlamanna/BootstrapFormHelpers
 * ==========================================================
 * Copyright 2012 Vincent Lamanna
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */
 
var BFHTimezonesList = {
  'AF': {
    'Asia/Kabul': 'Kabul'
  },
  'AL': {
    'Europe/Tirane': 'Tirane'
  },
  'DZ': {
    'Africa/Algiers': 'Algiers'
  },
  'AS': {
    'Pacific/Pago_Pago': 'Pago Pago'
  },
  'AD': {
    'Europe/Andorra': 'Andorra'
  },
  'AO': {
    'Africa/Luanda': 'Luanda'
  },
  'AI': {
    'America/Anguilla': 'Anguilla'
  },
  'AQ': {
    'Antarctica/Casey': 'Casey',
    'Antarctica/Davis': 'Davis',
    'Antarctica/DumontDUrville': 'DumontDUrville',
    'Antarctica/Macquarie': 'Macquarie',
    'Antarctica/Mawson': 'Mawson',
    'Antarctica/McMurdo': 'McMurdo',
    'Antarctica/Palmer': 'Palmer',
    'Antarctica/Rothera': 'Rothera',
    'Antarctica/South_Pole': 'South Pole',
    'Antarctica/Syowa': 'Syowa',
    'Antarctica/Vostok': 'Vostok'
  },
  'AG': {
    'America/Antigua': 'Antigua'
  },
  'AR': {
    'America/Argentina/Buenos_Aires': 'Argentina / Buenos Aires',
    'America/Argentina/Catamarca': 'Argentina / Catamarca',
    'America/Argentina/Cordoba': 'Argentina / Cordoba',
    'America/Argentina/Jujuy': 'Argentina / Jujuy',
    'America/Argentina/La_Rioja': 'Argentina / La Rioja',
    'America/Argentina/Mendoza': 'Argentina / Mendoza',
    'America/Argentina/Rio_Gallegos': 'Argentina / Rio Gallegos',
    'America/Argentina/Salta': 'Argentina / Salta',
    'America/Argentina/San_Juan': 'Argentina / San Juan',
    'America/Argentina/San_Luis': 'Argentina / San Luis',
    'America/Argentina/Tucuman': 'Argentina / Tucuman',
    'America/Argentina/Ushuaia': 'Argentina / Ushuaia'
  },
  'AM': {
    'Asia/Yerevan': 'Yerevan'
  },
  'AW': {
    'America/Aruba': 'Aruba'
  },
  'AU': {
    'Australia/Adelaide': 'Adelaide',
    'Australia/Brisbane': 'Brisbane',
    'Australia/Broken_Hill': 'Broken Hill',
    'Australia/Currie': 'Currie',
    'Australia/Darwin': 'Darwin',
    'Australia/Eucla': 'Eucla',
    'Australia/Hobart': 'Hobart',
    'Australia/Lindeman': 'Lindeman',
    'Australia/Lord_Howe': 'Lord Howe',
    'Australia/Melbourne': 'Melbourne',
    'Australia/Perth': 'Perth',
    'Australia/Sydney': 'Sydney'
  },
  'AT': {
    'Europe/Vienna': 'Vienna'
  },
  'AZ': {
    'Asia/Baku': 'Baku'
  },
  'BH': {
    'Asia/Bahrain': 'Bahrain'
  },
  'BD': {
    'Asia/Dhaka': 'Dhaka'
  },
  'BB': {
    'America/Barbados': 'Barbados'
  },
  'BY': {
    'Europe/Minsk': 'Minsk'
  },
  'BE': {
    'Europe/Brussels': 'Brussels'
  },
  'BZ': {
    'America/Belize': 'Belize'
  },
  'BJ': {
    'Africa/Porto-Novo': 'Porto-Novo'
  },
  'BM': {
    'Atlantic/Bermuda': 'Bermuda'
  },
  'BT': {
    'Asia/Thimphu': 'Thimphu'
  },
  'BO': {
    'America/La_Paz': 'La Paz'
  },
  'BA': {
    'Europe/Sarajevo': 'Sarajevo'
  },
  'BW': {
    'Africa/Gaborone': 'Gaborone'
  },
  'BR': {
    'America/Araguaina': 'Araguaina',
    'America/Bahia': 'Bahia',
    'America/Belem': 'Belem',
    'America/Boa_Vista': 'Boa Vista',
    'America/Campo_Grande': 'Campo Grande',
    'America/Cuiaba': 'Cuiaba',
    'America/Eirunepe': 'Eirunepe',
    'America/Fortaleza': 'Fortaleza',
    'America/Maceio': 'Maceio',
    'America/Manaus': 'Manaus',
    'America/Noronha': 'Noronha',
    'America/Porto_Velho': 'Porto Velho',
    'America/Recife': 'Recife',
    'America/Rio_Branco': 'Rio Branco',
    'America/Santarem': 'Santarem',
    'America/Sao_Paulo': 'Sao Paulo'
  },
  'VG': {
    'America/Tortola': 'Tortola'
  },
  'BN': {
    'Asia/Brunei': 'Brunei'
  },
  'BG': {
    'Europe/Sofia': 'Sofia'
  },
  'BF': {
    'Africa/Ouagadougou': 'Ouagadougou'
  },
  'BI': {
    'Africa/Bujumbura': 'Bujumbura'
  },
  'CI': {
    'Africa/Abidjan': 'Abidjan'
  },
  'KH': {
    'Asia/Phnom_Penh': 'Phnom Penh'
  },
  'CM': {
    'Africa/Douala': 'Douala'
  },
  'CA': {
    'America/Atikokan': 'Atikokan',
    'America/Blanc-Sablon': 'Blanc-Sablon',
    'America/Cambridge_Bay': 'Cambridge Bay',
    'America/Creston': 'Creston',
    'America/Dawson': 'Dawson',
    'America/Dawson_Creek': 'Dawson Creek',
    'America/Edmonton': 'Edmonton',
    'America/Glace_Bay': 'Glace Bay',
    'America/Goose_Bay': 'Goose Bay',
    'America/Halifax': 'Halifax',
    'America/Inuvik': 'Inuvik',
    'America/Iqaluit': 'Iqaluit',
    'America/Moncton': 'Moncton',
    'America/Montreal': 'Montreal',
    'America/Nipigon': 'Nipigon',
    'America/Pangnirtung': 'Pangnirtung',
    'America/Rainy_River': 'Rainy River',
    'America/Rankin_Inlet': 'Rankin Inlet',
    'America/Regina': 'Regina',
    'America/Resolute': 'Resolute',
    'America/St_Johns': 'St Johns',
    'America/Swift_Current': 'Swift Current',
    'America/Thunder_Bay': 'Thunder Bay',
    'America/Toronto': 'Toronto',
    'America/Vancouver': 'Vancouver',
    'America/Whitehorse': 'Whitehorse',
    'America/Winnipeg': 'Winnipeg',
    'America/Yellowknife': 'Yellowknife'
  },
  'CV': {
    'Atlantic/Cape_Verde': 'Cape Verde'
  },
  'KY': {
    'America/Cayman': 'Cayman'
  },
  'CF': {
    'Africa/Bangui': 'Bangui'
  },
  'TD': {
    'Africa/Ndjamena': 'Ndjamena'
  },
  'CL': {
    'America/Santiago': 'Santiago',
    'Pacific/Easter': 'Easter'
  },
  'CN': {
    'Asia/Chongqing': 'Chongqing',
    'Asia/Harbin': 'Harbin',
    'Asia/Kashgar': 'Kashgar',
    'Asia/Shanghai': 'Shanghai',
    'Asia/Urumqi': 'Urumqi'
  },
  'CO': {
    'America/Bogota': 'Bogota'
  },
  'KM': {
    'Indian/Comoro': 'Comoro'
  },
  'CG': {
    'Africa/Brazzaville': 'Brazzaville'
  },
  'CR': {
    'America/Costa_Rica': 'Costa Rica'
  },
  'HR': {
    'Europe/Zagreb': 'Zagreb'
  },
  'CU': {
    'America/Havana': 'Havana'
  },
  'CY': {
    'Asia/Nicosia': 'Nicosia'
  },
  'CZ': {
    'Europe/Prague': 'Prague'
  },
  'CD': {
    'Africa/Kinshasa': 'Kinshasa',
    'Africa/Lubumbashi': 'Lubumbashi'
  },
  'DK': {
    'Europe/Copenhagen': 'Copenhagen'
  },
  'DJ': {
    'Africa/Djibouti': 'Djibouti'
  },
  'DM': {
    'America/Dominica': 'Dominica'
  },
  'DO': {
    'America/Santo_Domingo': 'Santo Domingo'
  },
  'TP': {
  },
  'EC': {
    'America/Guayaquil': 'Guayaquil',
    'Pacific/Galapagos': 'Galapagos'
  },
  'EG': {
    'Africa/Cairo': 'Cairo'
  },
  'SV': {
    'America/El_Salvador': 'El Salvador'
  },
  'GQ': {
    'Africa/Malabo': 'Malabo'
  },
  'ER': {
    'Africa/Asmara': 'Asmara'
  },
  'EE': {
    'Europe/Tallinn': 'Tallinn'
  },
  'ET': {
    'Africa/Addis_Ababa': 'Addis Ababa'
  },
  'FO': {
    'Atlantic/Faroe': 'Faroe'
  },
  'FK': {
    'Atlantic/Stanley': 'Stanley'
  },
  'FJ': {
    'Pacific/Fiji': 'Fiji'
  },
  'FI': {
    'Europe/Helsinki': 'Helsinki'
  },
  'MK': {
    'Europe/Skopje': 'Skopje'
  },
  'FR': {
    'Europe/Paris': 'Paris'
  },
  'GA': {
    'Africa/Libreville': 'Libreville'
  },
  'GE': {
    'Asia/Tbilisi': 'Tbilisi'
  },
  'DE': {
    'Europe/Berlin': 'Berlin'
  },
  'GH': {
    'Africa/Accra': 'Accra'
  },
  'GR': {
    'Europe/Athens': 'Athens'
  },
  'GL': {
    'America/Danmarkshavn': 'Danmarkshavn',
    'America/Godthab': 'Godthab',
    'America/Scoresbysund': 'Scoresbysund',
    'America/Thule': 'Thule'
  },
  'GD': {
    'America/Grenada': 'Grenada'
  },
  'GU': {
    'Pacific/Guam': 'Guam'
  },
  'GT': {
    'America/Guatemala': 'Guatemala'
  },
  'GN': {
    'Africa/Conakry': 'Conakry'
  },
  'GW': {
    'Africa/Bissau': 'Bissau'
  },
  'GY': {
    'America/Guyana': 'Guyana'
  },
  'HT': {
    'America/Port-au-Prince': 'Port-au-Prince'
  },
  'HN': {
    'America/Tegucigalpa': 'Tegucigalpa'
  },
  'HK': {
    'Asia/Hong_Kong': 'Hong Kong'
  },
  'HU': {
    'Europe/Budapest': 'Budapest'
  },
  'IS': {
    'Atlantic/Reykjavik': 'Reykjavik'
  },
  'IN': {
    'Asia/Kolkata': 'Kolkata'
  },
  'ID': {
    'Asia/Jakarta': 'Jakarta',
    'Asia/Jayapura': 'Jayapura',
    'Asia/Makassar': 'Makassar',
    'Asia/Pontianak': 'Pontianak'
  },
  'IR': {
    'Asia/Tehran': 'Tehran'
  },
  'IQ': {
    'Asia/Baghdad': 'Baghdad'
  },
  'IE': {
    'Europe/Dublin': 'Dublin'
  },
  'IL': {
    'Asia/Jerusalem': 'Jerusalem'
  },
  'IT': {
    'Europe/Rome': 'Rome'
  },
  'JM': {
    'America/Jamaica': 'Jamaica'
  },
  'JP': {
    'Asia/Tokyo': 'Tokyo'
  },
  'JO': {
    'Asia/Amman': 'Amman'
  },
  'KZ': {
    'Asia/Almaty': 'Almaty',
    'Asia/Aqtau': 'Aqtau',
    'Asia/Aqtobe': 'Aqtobe',
    'Asia/Oral': 'Oral',
    'Asia/Qyzylorda': 'Qyzylorda'
  },
  'KE': {
    'Africa/Nairobi': 'Nairobi'
  },
  'KI': {
    'Pacific/Enderbury': 'Enderbury',
    'Pacific/Kiritimati': 'Kiritimati',
    'Pacific/Tarawa': 'Tarawa'
  },
  'KW': {
    'Asia/Kuwait': 'Kuwait'
  },
  'KG': {
    'Asia/Bishkek': 'Bishkek'
  },
  'LA': {
    'Asia/Vientiane': 'Vientiane'
  },
  'LV': {
    'Europe/Riga': 'Riga'
  },
  'LB': {
    'Asia/Beirut': 'Beirut'
  },
  'LS': {
    'Africa/Maseru': 'Maseru'
  },
  'LR': {
    'Africa/Monrovia': 'Monrovia'
  },
  'LY': {
    'Africa/Tripoli': 'Tripoli'
  },
  'LI': {
    'Europe/Vaduz': 'Vaduz'
  },
  'LT': {
    'Europe/Vilnius': 'Vilnius'
  },
  'LU': {
    'Europe/Luxembourg': 'Luxembourg'
  },
  'MO': {
    'Asia/Macau': 'Macau'
  },
  'MG': {
    'Indian/Antananarivo': 'Antananarivo'
  },
  'MW': {
    'Africa/Blantyre': 'Blantyre'
  },
  'MY': {
    'Asia/Kuala_Lumpur': 'Kuala Lumpur',
    'Asia/Kuching': 'Kuching'
  },
  'MV': {
    'Indian/Maldives': 'Maldives'
  },
  'ML': {
    'Africa/Bamako': 'Bamako'
  },
  'MT': {
    'Europe/Malta': 'Malta'
  },
  'MH': {
    'Pacific/Kwajalein': 'Kwajalein',
    'Pacific/Majuro': 'Majuro'
  },
  'MR': {
    'Africa/Nouakchott': 'Nouakchott'
  },
  'MU': {
    'Indian/Mauritius': 'Mauritius'
  },
  'MX': {
    'America/Bahia_Banderas': 'Bahia Banderas',
    'America/Cancun': 'Cancun',
    'America/Chihuahua': 'Chihuahua',
    'America/Hermosillo': 'Hermosillo',
    'America/Matamoros': 'Matamoros',
    'America/Mazatlan': 'Mazatlan',
    'America/Merida': 'Merida',
    'America/Mexico_City': 'Mexico City',
    'America/Monterrey': 'Monterrey',
    'America/Ojinaga': 'Ojinaga',
    'America/Santa_Isabel': 'Santa Isabel',
    'America/Tijuana': 'Tijuana'
  },
  'FM': {
    'Pacific/Chuuk': 'Chuuk',
    'Pacific/Kosrae': 'Kosrae',
    'Pacific/Pohnpei': 'Pohnpei'
  },
  'MD': {
    'Europe/Chisinau': 'Chisinau'
  },
  'MC': {
    'Europe/Monaco': 'Monaco'
  },
  'MN': {
    'Asia/Choibalsan': 'Choibalsan',
    'Asia/Hovd': 'Hovd',
    'Asia/Ulaanbaatar': 'Ulaanbaatar'
  },
  'ME': {
    'Europe/Podgorica': 'Podgorica'
  },
  'MS': {
    'America/Montserrat': 'Montserrat'
  },
  'MA': {
    'Africa/Casablanca': 'Casablanca'
  },
  'MZ': {
    'Africa/Maputo': 'Maputo'
  },
  'MM': {
    'Asia/Rangoon': 'Rangoon'
  },
  'NA': {
    'Africa/Windhoek': 'Windhoek'
  },
  'NR': {
    'Pacific/Nauru': 'Nauru'
  },
  'NP': {
    'Asia/Kathmandu': 'Kathmandu'
  },
  'NL': {
    'Europe/Amsterdam': 'Amsterdam'
  },
  'AN': {
  },
  'NZ': {
    'Pacific/Auckland': 'Auckland',
    'Pacific/Chatham': 'Chatham'
  },
  'NI': {
    'America/Managua': 'Managua'
  },
  'NE': {
    'Africa/Niamey': 'Niamey'
  },
  'NG': {
    'Africa/Lagos': 'Lagos'
  },
  'NF': {
    'Pacific/Norfolk': 'Norfolk'
  },
  'KP': {
    'Asia/Pyongyang': 'Pyongyang'
  },
  'MP': {
    'Pacific/Saipan': 'Saipan'
  },
  'NO': {
    'Europe/Oslo': 'Oslo'
  },
  'OM': {
    'Asia/Muscat': 'Muscat'
  },
  'PK': {
    'Asia/Karachi': 'Karachi'
  },
  'PW': {
    'Pacific/Palau': 'Palau'
  },
  'PA': {
    'America/Panama': 'Panama'
  },
  'PG': {
    'Pacific/Port_Moresby': 'Port Moresby'
  },
  'PY': {
    'America/Asuncion': 'Asuncion'
  },
  'PE': {
    'America/Lima': 'Lima'
  },
  'PH': {
    'Asia/Manila': 'Manila'
  },
  'PN': {
    'Pacific/Pitcairn': 'Pitcairn'
  },
  'PL': {
    'Europe/Warsaw': 'Warsaw'
  },
  'PT': {
    'Atlantic/Azores': 'Azores',
    'Atlantic/Madeira': 'Madeira',
    'Europe/Lisbon': 'Lisbon'
  },
  'PR': {
    'America/Puerto_Rico': 'Puerto Rico'
  },
  'QA': {
    'Asia/Qatar': 'Qatar'
  },
  'RO': {
    'Europe/Bucharest': 'Bucharest'
  },
  'RU': {
    'Asia/Anadyr': 'Anadyr',
    'Asia/Irkutsk': 'Irkutsk',
    'Asia/Kamchatka': 'Kamchatka',
    'Asia/Krasnoyarsk': 'Krasnoyarsk',
    'Asia/Magadan': 'Magadan',
    'Asia/Novokuznetsk': 'Novokuznetsk',
    'Asia/Novosibirsk': 'Novosibirsk',
    'Asia/Omsk': 'Omsk',
    'Asia/Sakhalin': 'Sakhalin',
    'Asia/Vladivostok': 'Vladivostok',
    'Asia/Yakutsk': 'Yakutsk',
    'Asia/Yekaterinburg': 'Yekaterinburg',
    'Europe/Kaliningrad': 'Kaliningrad',
    'Europe/Moscow': 'Moscow',
    'Europe/Samara': 'Samara',
    'Europe/Volgograd': 'Volgograd'
  },
  'RW': {
    'Africa/Kigali': 'Kigali'
  },
  'ST': {
    'Africa/Sao_Tome': 'Sao Tome'
  },
  'SH': {
    'Atlantic/St_Helena': 'St Helena'
  },
  'KN': {
    'America/St_Kitts': 'St Kitts'
  },
  'LC': {
    'America/St_Lucia': 'St Lucia'
  },
  'VC': {
    'America/St_Vincent': 'St Vincent'
  },
  'WS': {
    'Pacific/Apia': 'Apia'
  },
  'SM': {
    'Europe/San_Marino': 'San Marino'
  },
  'SA': {
    'Asia/Riyadh': 'Riyadh'
  },
  'SN': {
    'Africa/Dakar': 'Dakar'
  },
  'RS': {
    'Europe/Belgrade': 'Belgrade'
  },
  'SC': {
    'Indian/Mahe': 'Mahe'
  },
  'SL': {
    'Africa/Freetown': 'Freetown'
  },
  'SG': {
    'Asia/Singapore': 'Singapore'
  },
  'SK': {
    'Europe/Bratislava': 'Bratislava'
  },
  'SI': {
    'Europe/Ljubljana': 'Ljubljana'
  },
  'SB': {
    'Pacific/Guadalcanal': 'Guadalcanal'
  },
  'SO': {
    'Africa/Mogadishu': 'Mogadishu'
  },
  'ZA': {
    'Africa/Johannesburg': 'Johannesburg'
  },
  'GS': {
    'Atlantic/South_Georgia': 'South Georgia'
  },
  'KR': {
    'Asia/Seoul': 'Seoul'
  },
  'ES': {
    'Africa/Ceuta': 'Ceuta',
    'Atlantic/Canary': 'Canary',
    'Europe/Madrid': 'Madrid'
  },
  'LK': {
    'Asia/Colombo': 'Colombo'
  },
  'SD': {
    'Africa/Khartoum': 'Khartoum'
  },
  'SR': {
    'America/Paramaribo': 'Paramaribo'
  },
  'SZ': {
    'Africa/Mbabane': 'Mbabane'
  },
  'SE': {
    'Europe/Stockholm': 'Stockholm'
  },
  'CH': {
    'Europe/Zurich': 'Zurich'
  },
  'SY': {
    'Asia/Damascus': 'Damascus'
  },
  'TW': {
    'Asia/Taipei': 'Taipei'
  },
  'TJ': {
    'Asia/Dushanbe': 'Dushanbe'
  },
  'TZ': {
    'Africa/Dar_es_Salaam': 'Dar es Salaam'
  },
  'TH': {
    'Asia/Bangkok': 'Bangkok'
  },
  'BS': {
    'America/Nassau': 'Nassau'
  },
  'GM': {
    'Africa/Banjul': 'Banjul'
  },
  'TG': {
    'Africa/Lome': 'Lome'
  },
  'TO': {
    'Pacific/Tongatapu': 'Tongatapu'
  },
  'TT': {
    'America/Port_of_Spain': 'Port of Spain'
  },
  'TN': {
    'Africa/Tunis': 'Tunis'
  },
  'TR': {
    'Europe/Istanbul': 'Istanbul'
  },
  'TM': {
    'Asia/Ashgabat': 'Ashgabat'
  },
  'TC': {
    'America/Grand_Turk': 'Grand Turk'
  },
  'TV': {
    'Pacific/Funafuti': 'Funafuti'
  },
  'VI': {
    'America/St_Thomas': 'St Thomas'
  },
  'UG': {
    'Africa/Kampala': 'Kampala'
  },
  'UA': {
    'Europe/Kiev': 'Kiev',
    'Europe/Simferopol': 'Simferopol',
    'Europe/Uzhgorod': 'Uzhgorod',
    'Europe/Zaporozhye': 'Zaporozhye'
  },
  'AE': {
    'Asia/Dubai': 'Dubai'
  },
  'GB': {
    'Europe/London': 'London'
  },
  'US': {
    'America/Adak': 'Adak',
    'America/Anchorage': 'Anchorage',
    'America/Boise': 'Boise',
    'America/Chicago': 'Chicago',
    'America/Denver': 'Denver',
    'America/Detroit': 'Detroit',
    'America/Indiana/Indianapolis': 'Indiana / Indianapolis',
    'America/Indiana/Knox': 'Indiana / Knox',
    'America/Indiana/Marengo': 'Indiana / Marengo',
    'America/Indiana/Petersburg': 'Indiana / Petersburg',
    'America/Indiana/Tell_City': 'Indiana / Tell City',
    'America/Indiana/Vevay': 'Indiana / Vevay',
    'America/Indiana/Vincennes': 'Indiana / Vincennes',
    'America/Indiana/Winamac': 'Indiana / Winamac',
    'America/Juneau': 'Juneau',
    'America/Kentucky/Louisville': 'Kentucky / Louisville',
    'America/Kentucky/Monticello': 'Kentucky / Monticello',
    'America/Los_Angeles': 'Los Angeles',
    'America/Menominee': 'Menominee',
    'America/Metlakatla': 'Metlakatla',
    'America/New_York': 'New York',
    'America/Nome': 'Nome',
    'America/North_Dakota/Beulah': 'North Dakota / Beulah',
    'America/North_Dakota/Center': 'North Dakota / Center',
    'America/North_Dakota/New_Salem': 'North Dakota / New Salem',
    'America/Phoenix': 'Phoenix',
    'America/Shiprock': 'Shiprock',
    'America/Sitka': 'Sitka',
    'America/Yakutat': 'Yakutat',
    'Pacific/Honolulu': 'Honolulu'
  },
  'UY': {
    'America/Montevideo': 'Montevideo'
  },
  'UZ': {
    'Asia/Samarkand': 'Samarkand',
    'Asia/Tashkent': 'Tashkent'
  },
  'VU': {
    'Pacific/Efate': 'Efate'
  },
  'VA': {
    'Europe/Vatican': 'Vatican'
  },
  'VE': {
    'America/Caracas': 'Caracas'
  },
  'VN': {
    'Asia/Ho_Chi_Minh': 'Ho Chi Minh'
  },
  'EH': {
    'Africa/El_Aaiun': 'El Aaiun'
  },
  'YE': {
    'Asia/Aden': 'Aden'
  },
  'ZM': {
    'Africa/Lusaka': 'Lusaka'
  },
  'ZW': {
    'Africa/Harare': 'Harare'
  }
};

/* ==========================================================
 * bootstrap-formhelpers-colorpicker.js
 * https://github.com/vlamanna/BootstrapFormHelpers
 * ==========================================================
 * Copyright 2012 Vincent Lamanna
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */
 
 
+function ($) {

  'use strict';
  
  
  /* COLORPICKER CLASS DEFINITION
  * ========================= */

  var toggle = '[data-toggle=bfh-colorpicker]',
      BFHColorPicker = function (element, options) {
        this.options = $.extend({}, $.fn.bfhcolorpicker.defaults, options);
        this.$element = $(element);

        this.initPopover();
      };

  BFHColorPicker.prototype = {

    constructor: BFHColorPicker,

    initPalette: function() {
      var $canvas,
          context,
          gradient;
          
      $canvas = this.$element.find('canvas');
      context = $canvas[0].getContext('2d');
      
      gradient = context.createLinearGradient(0, 0, $canvas.width(), 0);
      
      gradient.addColorStop(0,    'rgb(255, 255, 255)');
      gradient.addColorStop(0.1,  'rgb(255,   0,   0)');
      gradient.addColorStop(0.25, 'rgb(255,   0, 255)');
      gradient.addColorStop(0.4,  'rgb(0,     0, 255)');
      gradient.addColorStop(0.55, 'rgb(0,   255, 255)');
      gradient.addColorStop(0.7,  'rgb(0,   255,   0)');
      gradient.addColorStop(0.85, 'rgb(255, 255,   0)');
      gradient.addColorStop(1,    'rgb(255,   0,   0)');
      
      context.fillStyle = gradient;
      context.fillRect(0, 0, context.canvas.width, context.canvas.height);
      
      gradient = context.createLinearGradient(0, 0, 0, $canvas.height());
      gradient.addColorStop(0,   'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
      gradient.addColorStop(0.5, 'rgba(0,     0,   0, 0)');
      gradient.addColorStop(1,   'rgba(0,     0,   0, 1)');
      
      context.fillStyle = gradient;
      context.fillRect(0, 0, context.canvas.width, context.canvas.height);
    },
    
    initPopover: function() {
      var iconLeft,
          iconRight;

      iconLeft = '';
      iconRight = '';
      if (this.options.align === 'right') {
        iconRight = '<span class="input-group-addon"><span class="bfh-colorpicker-icon"></span></span>';
      } else {
        iconLeft = '<span class="input-group-addon"><span class="bfh-colorpicker-icon"></span></span>';
      }

      this.$element.html(
        '<div class="input-group bfh-colorpicker-toggle" data-toggle="bfh-colorpicker">' +
        iconLeft +
        '<input type="text" name="' + this.options.name + '" class="' + this.options.input + '" placeholder="' + this.options.placeholder + '" readonly>' +
        iconRight +
        '</div>' +
        '<div class="bfh-colorpicker-popover">' +
        '<canvas class="bfh-colorpicker-palette" width="384" height="256"></canvas>' +
        '</div>'
      );

      this.$element
        .on('click.bfhcolorpicker.data-api touchstart.bfhcolorpicker.data-api', toggle, BFHColorPicker.prototype.toggle)
        .on('mousedown.bfhcolorpicker.data-api', 'canvas', BFHColorPicker.prototype.mouseDown)
        .on('click.bfhcolorpicker.data-api touchstart.bfhcolorpicker.data-api', '.bfh-colorpicker-popover', function() { return false; });

      this.initPalette();
      
      this.$element.val(this.options.color);
    },
    
    updateVal: function(positionX, positionY) {
      var $canvas,
          context,
          colorX,
          colorY,
          snappiness,
          imageData,
          newColor;
      
      snappiness = 5;
      
      $canvas = this.$element.find('canvas');
      context = $canvas[0].getContext('2d');
      
      colorX = positionX - $canvas.offset().left;
      colorY = positionY - $canvas.offset().top;
      
      colorX = Math.round(colorX / snappiness) * snappiness;
      colorY = Math.round(colorY / snappiness) * snappiness;
      
      if (colorX < 0) {
        colorX = 0;
      }
      if (colorX >= $canvas.width()) {
        colorX = $canvas.width() - 1;
      }
      
      if (colorY < 0) {
        colorY = 0;
      }
      if (colorY > $canvas.height()) {
        colorY = $canvas.height();
      }
      
      imageData = context.getImageData(colorX, colorY, 1, 1);
      newColor = rgbToHex(imageData.data[0], imageData.data[1], imageData.data[2]);
      
      if (newColor !== this.$element.val()) {
        this.$element.val(newColor);
        
        this.$element.trigger('change.bfhcolorpicker');
      }
    },
    
    mouseDown: function(e) {
      var $this,
          $parent;
      
      $this = $(this);
      $parent = getParent($this);
      
      $(document)
        .on('mousemove.bfhcolorpicker.data-api', {colorpicker: $parent}, BFHColorPicker.prototype.mouseMove)
        .one('mouseup.bfhcolorpicker.data-api', {colorpicker: $parent}, BFHColorPicker.prototype.mouseUp);
    },
    
    mouseMove: function(e) {
      var $this;
      
      $this = e.data.colorpicker;
      
      $this.data('bfhcolorpicker').updateVal(e.pageX, e.pageY);
    },
    
    mouseUp: function(e) {
      var $this;
      
      $this = e.data.colorpicker;
      
      $this.data('bfhcolorpicker').updateVal(e.pageX, e.pageY);
      
      $(document).off('mousemove.bfhcolorpicker.data-api');
      
      if ($this.data('bfhcolorpicker').options.close === true) {
        clearMenus();
      }
    },

    toggle: function (e) {
      var $this,
          $parent,
          isActive;

      $this = $(this);
      $parent = getParent($this);

      if ($parent.is('.disabled') || $parent.attr('disabled') !== undefined) {
        return true;
      }

      isActive = $parent.hasClass('open');

      clearMenus();

      if (!isActive) {
        $parent.trigger(e = $.Event('show.bfhcolorpicker'));

        if (e.isDefaultPrevented()) {
          return true;
        }

        $parent
          .toggleClass('open')
          .trigger('shown.bfhcolorpicker');

        $this.focus();
      }

      return false;
    }
  };
  
  function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }

  function rgbToHex(r, g, b) {
    return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b);
  }
      
  function clearMenus() {
    var $parent;

    $(toggle).each(function (e) {
      $parent = getParent($(this));

      if (!$parent.hasClass('open')) {
        return true;
      }

      $parent.trigger(e = $.Event('hide.bfhcolorpicker'));

      if (e.isDefaultPrevented()) {
        return true;
      }

      $parent
        .removeClass('open')
        .trigger('hidden.bfhcolorpicker');
    });
  }

  function getParent($this) {
    return $this.closest('.bfh-colorpicker');
  }
  
  
  /* COLORPICKER PLUGIN DEFINITION
   * ========================== */

  var old = $.fn.bfhcolorpicker;

  $.fn.bfhcolorpicker = function (option) {
    return this.each(function () {
      var $this,
          data,
          options;

      $this = $(this);
      data = $this.data('bfhcolorpicker');
      options = typeof option === 'object' && option;
      this.type = 'bfhcolorpicker';

      if (!data) {
        $this.data('bfhcolorpicker', (data = new BFHColorPicker(this, options)));
      }
      if (typeof option === 'string') {
        data[option].call($this);
      }
    });
  };

  $.fn.bfhcolorpicker.Constructor = BFHColorPicker;

  $.fn.bfhcolorpicker.defaults = {
    align: 'left',
    input: 'form-control',
    placeholder: '',
    name: '',
    color: '#000000',
    close: true
  };
  
  
  /* COLORPICKER NO CONFLICT
   * ========================== */

  $.fn.bfhcolorpicker.noConflict = function () {
    $.fn.bfhcolorpicker = old;
    return this;
  };
  
  
  /* COLORPICKER VALHOOKS
   * ========================== */

  var origHook;
  if ($.valHooks.div){
    origHook = $.valHooks.div;
  }
  $.valHooks.div = {
    get: function(el) {
      if ($(el).hasClass('bfh-colorpicker')) {
        return $(el).find('input[type="text"]').val();
      } else if (origHook) {
        return origHook.get(el);
      }
    },
    set: function(el, val) {
      if ($(el).hasClass('bfh-colorpicker')) {
        $(el).find('.bfh-colorpicker-icon').css('background-color', val);
        $(el).find('input[type="text"]').val(val);
      } else if (origHook) {
        return origHook.set(el,val);
      }
    }
  };
  
  
  /* COLORPICKER DATA-API
   * ============== */

  $(document).ready( function () {
    $('div.bfh-colorpicker').each(function () {
      var $colorpicker;

      $colorpicker = $(this);

      $colorpicker.bfhcolorpicker($colorpicker.data());
    });
  });
  
  
  /* APPLY TO STANDARD COLORPICKER ELEMENTS
   * =================================== */

  $(document)
    .on('click.bfhcolorpicker.data-api', clearMenus);

}(window.jQuery);
/* ==========================================================
 * bootstrap-formhelpers-countries.js
 * https://github.com/vlamanna/BootstrapFormHelpers
 * ==========================================================
 * Copyright 2012 Vincent Lamanna
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */

+function ($) {

  'use strict';


  /* COUNTRIES CLASS DEFINITION
   * ====================== */

  var BFHCountries = function (element, options) {
    this.options = $.extend({}, $.fn.bfhcountries.defaults, options);
    this.$element = $(element);

    if (this.$element.is('select')) {
      this.addCountries();
    }

    if (this.$element.hasClass('bfh-selectbox')) {
      this.addBootstrapCountries();
    }

    if (this.$element.is('span')) {
      this.displayCountry();
    }
  };

  BFHCountries.prototype = {

    constructor: BFHCountries,

    getCountries: function() {
      var country,
          countries;

      if (this.options.available) {
        if (typeof this.options.available === 'string') {
          countries = [];
  
          this.options.available = this.options.available.split(',');
  
          for (country in BFHCountriesList) {
            if (BFHCountriesList.hasOwnProperty(country)) {
              if ($.inArray(country, this.options.available) >= 0) {
                countries[country] = BFHCountriesList[country];
              }
            }
          }
        } else {
          countries = this.options.available;
        }

        return countries;
      } else {
        return BFHCountriesList;
      }
    },

    addCountries: function () {
      var value,
          country,
          countries;

      value = this.options.country;
      countries = this.getCountries();

      this.$element.html('');

      if (this.options.blank === true) {
        this.$element.append('<option value=""></option>');
      }

      for (country in countries) {
        if (countries.hasOwnProperty(country)) {
          this.$element.append('<option value="' + country + '">' + countries[country] + '</option>');
        }
      }

      this.$element.val(value);
    },

    addBootstrapCountries: function() {
      var $input,
          $toggle,
          $options,
          value,
          country,
          countries;

      value = this.options.country;
      $input = this.$element.find('input[type="hidden"]');
      $toggle = this.$element.find('.bfh-selectbox-option');
      $options = this.$element.find('[role=option]');
      countries = this.getCountries();

      $options.html('');

      if (this.options.blank === true) {
        $options.append('<li><a tabindex="-1" href="#" data-option=""></a></li>');
      }

      for (country in countries) {
        if (countries.hasOwnProperty(country)) {
          if (this.options.flags === true) {
            $options.append('<li><a tabindex="-1" href="#" data-option="' + country + '"><i class="glyphicon bfh-flag-' + country + '"></i>' + countries[country] + '</a></li>');
          } else {
            $options.append('<li><a tabindex="-1" href="#" data-option="' + country + '">' + countries[country] + '</a></li>');
          }
        }
      }

      this.$element.val(value);
    },

    displayCountry: function () {
      var value;

      value = this.options.country;

      if (this.options.flags === true) {
        this.$element.html('<i class="glyphicon bfh-flag-' + value + '"></i> ' + BFHCountriesList[value]);
      } else {
        this.$element.html(BFHCountriesList[value]);
      }
    }

  };


  /* COUNTRY PLUGIN DEFINITION
   * ======================= */

  var old = $.fn.bfhcountries;

  $.fn.bfhcountries = function (option) {
    return this.each(function () {
      var $this,
          data,
          options;

      $this = $(this);
      data = $this.data('bfhcountries');
      options = typeof option === 'object' && option;

      if (!data) {
        $this.data('bfhcountries', (data = new BFHCountries(this, options)));
      }
      if (typeof option === 'string') {
        data[option].call($this);
      }
    });
  };

  $.fn.bfhcountries.Constructor = BFHCountries;

  $.fn.bfhcountries.defaults = {
    country: '',
    available: '',
    flags: false,
    blank: true
  };


  /* COUNTRY NO CONFLICT
   * ========================== */

  $.fn.bfhcountries.noConflict = function () {
    $.fn.bfhcountries = old;
    return this;
  };


  /* COUNTRY DATA-API
   * ============== */

  $(document).ready( function () {
    $('form select.bfh-countries, span.bfh-countries, div.bfh-countries').each(function () {
      var $countries;

      $countries = $(this);

      if ($countries.hasClass('bfh-selectbox')) {
        $countries.bfhselectbox($countries.data());
      }
      $countries.bfhcountries($countries.data());
    });
  });

}(window.jQuery);

/* ==========================================================
 * bootstrap-formhelpers-currencies.js
 * https://github.com/vlamanna/BootstrapFormHelpers
 * ==========================================================
 * Copyright 2013 Vincent Lamanna
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */

+function ($) {

  'use strict';


  /* COUNTRIES CLASS DEFINITION
   * ====================== */

  var BFHCurrencies = function (element, options) {
    this.options = $.extend({}, $.fn.bfhcurrencies.defaults, options);
    this.$element = $(element);

    if (this.$element.is('select')) {
      this.addCurrencies();
    }

    if (this.$element.hasClass('bfh-selectbox')) {
      this.addBootstrapCurrencies();
    }

    if (this.$element.is('span')) {
      this.displayCurrency();
    }
  };

  BFHCurrencies.prototype = {

    constructor: BFHCurrencies,

    getCurrencies: function () {
      var currency,
          currencies;

      if (this.options.available) {
        currencies = [];

        this.options.available = this.options.available.split(',');

        for (currency in BFHCurrenciesList) {
          if (BFHCurrenciesList.hasOwnProperty(currency)) {
            if ($.inArray(currency, this.options.available) >= 0) {
              currencies[currency] = BFHCurrenciesList[currency];
            }
          }
        }

        return currencies;
      } else {
        return BFHCurrenciesList;
      }
    },

    addCurrencies: function () {
      var value,
          currency,
          currencies;

      value = this.options.currency;
      currencies = this.getCurrencies();

      this.$element.html('');

      if (this.options.blank === true) {
        this.$element.append('<option value=""></option>');
      }

      for (currency in currencies) {
        if (currencies.hasOwnProperty(currency)) {
          this.$element.append('<option value="' + currency + '">' + currencies[currency].label + '</option>');
        }
      }

      this.$element.val(value);
    },


    addBootstrapCurrencies: function() {
      var $input,
          $toggle,
          $options,
          value,
          currency,
          currencies,
          flag;

      value = this.options.currency;
      $input = this.$element.find('input[type="hidden"]');
      $toggle = this.$element.find('.bfh-selectbox-option');
      $options = this.$element.find('[role=option]');
      currencies = this.getCurrencies();

      $options.html('');

      if (this.options.blank === true) {
        $options.append('<li><a tabindex="-1" href="#" data-option=""></a></li>');
      }

      for (currency in currencies) {
        if (currencies.hasOwnProperty(currency)) {
          if (this.options.flags === true) {
            if (currencies[currency].currencyflag) {
              flag = currencies[currency].currencyflag;
            } else {
              flag = currency.substr(0,2);
            }
            $options.append('<li><a tabindex="-1" href="#" data-option="' + currency +  '"><i class="glyphicon bfh-flag-' + flag + '"></i>' + currencies[currency].label + '</a></li>');
          } else {
            $options.append('<li><a tabindex="-1" href="#" data-option="' + currency + '">' + currencies[currency].label + '</a></li>');
          }
        }
      }

      this.$element.val(value);
    },

    displayCurrency: function () {
      var value,
          flag;

      value = this.options.currency;

      if (this.options.flags === true) {
        if (BFHCurrenciesList[value].currencyflag) {
          flag = BFHCurrenciesList[value].currencyflag;
        } else {
          flag = value.substr(0,2);
        }
        this.$element.html('<i class="glyphicon bfh-flag-' + flag + '"></i> ' + BFHCurrenciesList[value].label);
      } else {
        this.$element.html(BFHCurrenciesList[value].label);
      }
    }

  };


  /* CURRENCY PLUGIN DEFINITION
   * ======================= */

  var old = $.fn.bfhcurrencies;

  $.fn.bfhcurrencies = function (option) {
    return this.each(function () {
      var $this,
          data,
          options;

      $this = $(this);
      data = $this.data('bfhcurrencies');
      options = typeof option === 'object' && option;

      if (!data) {
        $this.data('bfhcurrencies', (data = new BFHCurrencies(this, options)));
      }
      if (typeof option === 'string') {
        data[option].call($this);
      }
    });
  };

  $.fn.bfhcurrencies.Constructor = BFHCurrencies;

  $.fn.bfhcurrencies.defaults = {
    currency: '',
    available: '',
    flags: false,
    blank: true
  };


  /* CURRENCY NO CONFLICT
   * ========================== */

  $.fn.bfhcurrencies.noConflict = function () {
    $.fn.bfhcurrencies = old;
    return this;
  };


  /* CURRENCY DATA-API
   * ============== */

  $(document).ready( function () {
    $('form select.bfh-currencies, span.bfh-currencies, div.bfh-currencies').each(function () {
      var $currencies;

      $currencies = $(this);

      if ($currencies.hasClass('bfh-selectbox')) {
        $currencies.bfhselectbox($currencies.data());
      }
      $currencies.bfhcurrencies($currencies.data());
    });
  });


}(window.jQuery);

/* ==========================================================
 * bootstrap-formhelpers-datepicker.js
 * https://github.com/vlamanna/BootstrapFormHelpers
 * ==========================================================
 * Copyright 2012 Vincent Lamanna
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */

+function ($) {

  'use strict';


  /* BFHDATEPICKER CLASS DEFINITION
   * ========================= */

  var toggle = '[data-toggle=bfh-datepicker]',
      BFHDatePicker = function (element, options) {
        this.options = $.extend({}, $.fn.bfhdatepicker.defaults, options);
        this.$element = $(element);

        this.initCalendar();
      };

  BFHDatePicker.prototype = {

    constructor: BFHDatePicker,

    setDate: function() {
      var date,
          today,
          format;

      date = this.options.date;
      format = this.options.format;

      if (date === '' || date === 'today' || date === undefined) {
        today = new Date();

        if (date === 'today') {
          this.$element.val(formatDate(format, today.getMonth(), today.getFullYear(), today.getDate()));
        }

        this.$element.data('month', today.getMonth());
        this.$element.data('year', today.getFullYear());
      } else {
        this.$element.val(date);
        this.$element.data('month', Number(getDatePart(format, date, 'm') - 1));
        this.$element.data('year', Number(getDatePart(format, date, 'y')));
      }
    },

    setDateLimit: function(date, limitPrefix) {
      var today,
          format;

      format = this.options.format;

      if (date !== '') {
        this.$element.data(limitPrefix + 'limit', true);

        if (date === 'today') {
          today = new Date();

          this.$element.data(limitPrefix + 'day', today.getDate());
          this.$element.data(limitPrefix + 'month', today.getMonth());
          this.$element.data(limitPrefix + 'year', today.getFullYear());
        } else {
          this.$element.data(limitPrefix + 'day', Number(getDatePart(format, date, 'd')));
          this.$element.data(limitPrefix + 'month', Number(getDatePart(format, date, 'm') - 1));
          this.$element.data(limitPrefix + 'year', Number(getDatePart(format, date, 'y')));
        }
      } else {
        this.$element.data(limitPrefix + 'limit', false);
      }
    },

    initCalendar: function() {
      var iconLeft,
          iconRight,
          iconAddon;

      iconLeft = '';
      iconRight = '';
      iconAddon = '';
      if (this.options.icon !== '') {
        if (this.options.align === 'right') {
          iconRight = '<span class="input-group-addon"><i class="' + this.options.icon + '"></i></span>';
        } else {
          iconLeft = '<span class="input-group-addon"><i class="' + this.options.icon + '"></i></span>';
        }
        iconAddon = 'input-group';
      }

      this.$element.html(
        '<div class="' + iconAddon + ' bfh-datepicker-toggle" data-toggle="bfh-datepicker">' +
        iconLeft +
        '<input type="text" name="' + this.options.name + '" class="' + this.options.input + '" placeholder="' + this.options.placeholder + '" readonly>' +
        iconRight +
        '</div>' +
        '<div class="bfh-datepicker-calendar">' +
        '<table class="calendar table table-bordered">' +
        '<thead>' +
        '<tr class="months-header">' +
        '<th class="month" colspan="4">' +
        '<a class="previous" href="#"><i class="glyphicon glyphicon-chevron-left"></i></a>' +
        '<span></span>' +
        '<a class="next" href="#"><i class="glyphicon glyphicon-chevron-right"></i></a>' +
        '</th>' +
        '<th class="year" colspan="3">' +
        '<a class="previous" href="#"><i class="glyphicon glyphicon-chevron-left"></i></a>' +
        '<span></span>' +
        '<a class="next" href="#"><i class="glyphicon glyphicon-chevron-right"></i></a>' +
        '</th>' +
        '</tr>' +
        '<tr class="days-header">' +
        '</tr>' +
        '</thead>' +
        '<tbody>' +
        '</tbody>' +
        '</table>' +
        '</div>'
      );

      this.$element
        .on('click.bfhdatepicker.data-api touchstart.bfhdatepicker.data-api', toggle, BFHDatePicker.prototype.toggle)
        .on('click.bfhdatepicker.data-api touchstart.bfhdatepicker.data-api', '.bfh-datepicker-calendar > table.calendar .month > .previous', BFHDatePicker.prototype.previousMonth)
        .on('click.bfhdatepicker.data-api touchstart.bfhdatepicker.data-api', '.bfh-datepicker-calendar > table.calendar .month > .next', BFHDatePicker.prototype.nextMonth)
        .on('click.bfhdatepicker.data-api touchstart.bfhdatepicker.data-api', '.bfh-datepicker-calendar > table.calendar .year > .previous', BFHDatePicker.prototype.previousYear)
        .on('click.bfhdatepicker.data-api touchstart.bfhdatepicker.data-api', '.bfh-datepicker-calendar > table.calendar .year > .next', BFHDatePicker.prototype.nextYear)
        .on('click.bfhdatepicker.data-api touchstart.bfhdatepicker.data-api', '.bfh-datepicker-calendar > table.calendar td:not(.off)', BFHDatePicker.prototype.select)
        .on('click.bfhdatepicker.data-api touchstart.bfhdatepicker.data-api', '.bfh-datepicker-calendar > table.calendar', function() { return false; });

      this.setDate();
      this.setDateLimit(this.options.min, 'lower');
      this.setDateLimit(this.options.max, 'higher');

      this.updateCalendar();
    },

    updateCalendarHeader: function($calendar, month, year) {
      var $daysHeader,
          day;

      $calendar.find('table > thead > tr > th.month > span').text(BFHMonthsList[month]);
      $calendar.find('table > thead > tr > th.year > span').text(year);

      $daysHeader = $calendar.find('table > thead > tr.days-header');
      $daysHeader.html('');
      for (day=BFHDayOfWeekStart; day < BFHDaysList.length; day=day+1) {
        $daysHeader.append('<th>' + BFHDaysList[day] + '</th>');
      }
      for (day=0; day < BFHDayOfWeekStart; day=day+1) {
        $daysHeader.append('<th>' + BFHDaysList[day] + '</th>');
      }
    },

    checkMinDate: function(day, month, year) {
      var lowerlimit,
          lowerday,
          lowermonth,
          loweryear;

      lowerlimit = this.$element.data('lowerlimit');

      if (lowerlimit === true) {
        lowerday = this.$element.data('lowerday');
        lowermonth = this.$element.data('lowermonth');
        loweryear = this.$element.data('loweryear');

        if ((day < lowerday && month === lowermonth && year === loweryear) || (month < lowermonth && year === loweryear) || (year < loweryear)) {
          return true;
        }
      }

      return false;
    },

    checkMaxDate: function(day, month, year) {
      var higherlimit,
          higherday,
          highermonth,
          higheryear;

      higherlimit = this.$element.data('higherlimit');

      if (higherlimit === true) {
        higherday = this.$element.data('higherday');
        highermonth = this.$element.data('highermonth');
        higheryear = this.$element.data('higheryear');

        if ((day > higherday && month === highermonth && year === higheryear) || (month > highermonth && year === higheryear) || (year > higheryear)) {
          return true;
        }
      }

      return false;
    },

    checkToday: function(day, month, year) {
      var today;

      today = new Date();

      if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
        return true;
      }

      return false;
    },

    updateCalendarDays: function($calendar, month, year) {
      var $days,
          numDaysPreviousMonth,
          numDaysCurrentMonth,
          firstDay,
          lastDay,
          row,
          day;

      $days = $calendar.find('table > tbody').html('');
      numDaysPreviousMonth = getNumDaysInMonth(month, year);
      numDaysCurrentMonth = getNumDaysInMonth(month + 1, year);
      firstDay = getDayOfWeek(month, year, 1);
      lastDay = getDayOfWeek(month, year, numDaysCurrentMonth);

      row = '';
      for (day=0; day < (firstDay - BFHDayOfWeekStart + 7) % 7; day=day+1) {
        row += '<td class="off">' + (numDaysPreviousMonth - (firstDay - BFHDayOfWeekStart + 7) % 7 + day + 1) + '</td>';
      }

      for (day=1; day <= numDaysCurrentMonth; day=day+1) {
        if (this.checkMinDate(day, month, year)) {
          row += '<td data-day="' + day + '" class="off">' + day + '</td>';
        } else if (this.checkMaxDate(day, month, year)) {
          row += '<td data-day="' + day + '" class="off">' + day + '</td>';
        } else if (this.checkToday(day, month, year)) {
          row += '<td data-day="' + day + '" class="today">' + day + '</td>';
        } else {
          row += '<td data-day="' + day + '">' + day + '</td>';
        }
        if (getDayOfWeek(month, year, day) === (6 + BFHDayOfWeekStart) % 7) {
          $days.append('<tr>' + row + '</tr>');
          row = '';
        }
      }

      for (day=1; day <= (7 - ((lastDay + 1 - BFHDayOfWeekStart + 7) % 7)) % 7 + 1; day=day+1) {
        row += '<td class="off">' + day + '</td>';
        if (day === (7 - ((lastDay + 1 - BFHDayOfWeekStart + 7) % 7)) % 7) {
          $days.append('<tr>' + row + '</tr>');
        }
      }
    },

    updateCalendar: function () {
      var $calendar,
          month,
          year;

      $calendar = this.$element.find('.bfh-datepicker-calendar');
      month = this.$element.data('month');
      year = this.$element.data('year');

      this.updateCalendarHeader($calendar, month, year);
      this.updateCalendarDays($calendar, month, year);
    },

    previousMonth: function () {
      var $this,
          $parent,
          $datePicker;

      $this = $(this);
      $parent = getParent($this);

      if (Number($parent.data('month')) === 0) {
        $parent.data('month', 11);
        $parent.data('year', Number($parent.data('year')) - 1);
      } else {
        $parent.data('month', Number($parent.data('month')) - 1);
      }

      $datePicker = $parent.data('bfhdatepicker');
      $datePicker.updateCalendar();

      return false;
    },

    nextMonth: function () {
      var $this,
          $parent,
          $datePicker;

      $this = $(this);
      $parent = getParent($this);

      if (Number($parent.data('month')) === 11) {
        $parent.data('month', 0);
        $parent.data('year', Number($parent.data('year')) + 1);
      } else {
        $parent.data('month', Number($parent.data('month')) + 1);
      }

      $datePicker = $parent.data('bfhdatepicker');
      $datePicker.updateCalendar();

      return false;
    },

    previousYear: function () {
      var $this,
          $parent,
          $datePicker;

      $this = $(this);
      $parent = getParent($this);

      $parent.data('year', Number($parent.data('year')) - 1);

      $datePicker = $parent.data('bfhdatepicker');
      $datePicker.updateCalendar();

      return false;
    },

    nextYear: function () {
      var $this,
          $parent,
          $datePicker;

      $this = $(this);
      $parent = getParent($this);

      $parent.data('year', Number($parent.data('year')) + 1);

      $datePicker = $parent.data('bfhdatepicker');
      $datePicker.updateCalendar();

      return false;
    },

    select: function (e) {
      var $this,
          $parent,
          $datePicker,
          month,
          year,
          day;

      $this = $(this);

      e.preventDefault();
      e.stopPropagation();

      $parent = getParent($this);
      $datePicker = $parent.data('bfhdatepicker');
      month = $parent.data('month');
      year = $parent.data('year');
      day = $this.data('day');

      $parent.val(formatDate($datePicker.options.format, month, year, day));
      $parent.trigger('change.bfhdatepicker');

      if ($datePicker.options.close === true) {
        clearMenus();
      }
    },

    toggle: function (e) {
      var $this,
          $parent,
          isActive;

      $this = $(this);
      $parent = getParent($this);

      if ($parent.is('.disabled') || $parent.attr('disabled') !== undefined) {
        return true;
      }

      isActive = $parent.hasClass('open');

      clearMenus();

      if (!isActive) {
        $parent.trigger(e = $.Event('show.bfhdatepicker'));

        if (e.isDefaultPrevented()) {
          return true;
        }

        $parent
          .toggleClass('open')
          .trigger('shown.bfhdatepicker');

        $this.focus();
      }

      return false;
    }
  };

  function getNumDaysInMonth(month, year) {
    return new Date(year, month, 0).getDate();
  }

  function getDayOfWeek(month, year, day) {
    return new Date(year, month, day).getDay();
  }

  function formatDate(format, month, year, day) {
    month += 1;
    month = String(month);
    day = String(day);

    if (month.length === 1) {
      month = '0' + month;
    }
    if (day.length === 1) {
      day = '0' + day;
    }

    return format.replace('m', month).replace('y', year).replace('d', day);
  }

  function getDatePart(format, date, part) {
    var partPositions,
        partPosition,
        parts;

    partPositions = [
      {'part': 'm', 'position': format.indexOf('m')},
      {'part': 'y', 'position': format.indexOf('y')},
      {'part': 'd', 'position': format.indexOf('d')}
    ];

    partPositions.sort(function(a, b) {return a.position - b.position;});

    parts = date.match(/(\d+)/g);

    for (partPosition in partPositions) {
      if (partPositions.hasOwnProperty(partPosition)) {
        if (partPositions[partPosition].part === part) {
          return Number(parts[partPosition]).toString();
        }
      }
    }
  }

  function clearMenus() {
    var $parent;

    $(toggle).each(function (e) {
      $parent = getParent($(this));

      if (!$parent.hasClass('open')) {
        return true;
      }

      $parent.trigger(e = $.Event('hide.bfhdatepicker'));

      if (e.isDefaultPrevented()) {
        return true;
      }

      $parent
        .removeClass('open')
        .trigger('hidden.bfhdatepicker');
    });
  }

  function getParent($this) {
    return $this.closest('.bfh-datepicker');
  }


  /* DATEPICKER PLUGIN DEFINITION
   * ========================== */

  var old = $.fn.bfhdatepicker;

  $.fn.bfhdatepicker = function (option) {
    return this.each(function () {
      var $this,
          data,
          options;

      $this = $(this);
      data = $this.data('bfhdatepicker');
      options = typeof option === 'object' && option;
      this.type = 'bfhdatepicker';

      if (!data) {
        $this.data('bfhdatepicker', (data = new BFHDatePicker(this, options)));
      }
      if (typeof option === 'string') {
        data[option].call($this);
      }
    });
  };

  $.fn.bfhdatepicker.Constructor = BFHDatePicker;

  $.fn.bfhdatepicker.defaults = {
    icon: 'glyphicon glyphicon-calendar',
    align: 'left',
    input: 'form-control',
    placeholder: '',
    name: '',
    date: 'today',
    format: 'm/d/y',
    min: '',
    max: '',
    close: true
  };


  /* DATEPICKER NO CONFLICT
   * ========================== */

  $.fn.bfhdatepicker.noConflict = function () {
    $.fn.bfhdatepicker = old;
    return this;
  };


  /* DATEPICKER VALHOOKS
   * ========================== */

  var origHook;
  if ($.valHooks.div){
    origHook = $.valHooks.div;
  }
  $.valHooks.div = {
    get: function(el) {
      if ($(el).hasClass('bfh-datepicker')) {
        return $(el).find('input[type="text"]').val();
      } else if (origHook) {
        return origHook.get(el);
      }
    },
    set: function(el, val) {
      if ($(el).hasClass('bfh-datepicker')) {
        $(el).find('input[type="text"]').val(val);
      } else if (origHook) {
        return origHook.set(el,val);
      }
    }
  };


  /* DATEPICKER DATA-API
   * ============== */

  $(document).ready( function () {
    $('div.bfh-datepicker').each(function () {
      var $datepicker;

      $datepicker = $(this);

      $datepicker.bfhdatepicker($datepicker.data());
    });
  });


  /* APPLY TO STANDARD DATEPICKER ELEMENTS
   * =================================== */

  $(document)
    .on('click.bfhdatepicker.data-api', clearMenus);

}(window.jQuery);

/* ==========================================================
 * bootstrap-formhelpers-fonts.js
 * https://github.com/vlamanna/BootstrapFormHelpers
 * ==========================================================
 * Copyright 2012 Vincent Lamanna
 * contributed by Aaron Collegeman, Squidoo, 2012
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */

+function ($) {

  'use strict';


  /* FONTS CLASS DEFINITION
   * ====================== */

  var BFHFonts = function (element, options) {
    this.options = $.extend({}, $.fn.bfhfonts.defaults, options);
    this.$element = $(element);

    if (this.$element.is('select')) {
      this.addFonts();
    }

    if (this.$element.hasClass('bfh-selectbox')) {
      this.addBootstrapFonts();
    }
  };

  BFHFonts.prototype = {

    constructor: BFHFonts,

    getFonts: function() {
      var font,
          fonts;

      if (this.options.available) {
        fonts = [];

        this.options.available = this.options.available.split(',');

        for (font in BFHFontsList) {
          if (BFHFontsList.hasOwnProperty(font)) {
            if ($.inArray(font, this.options.available) >= 0) {
              fonts[font] = BFHFontsList[font];
            }
          }
        }

        return fonts;
      } else {
        return BFHFontsList;
      }
    },

    addFonts: function () {
      var value,
          font,
          fonts;

      value = this.options.font;
      fonts = this.getFonts();

      this.$element.html('');

      if (this.options.blank === true) {
        this.$element.append('<option value=""></option>');
      }

      for (font in fonts) {
        if (fonts.hasOwnProperty(font)) {
          this.$element.append('<option value="' + font + '">' + font + '</option>');
        }
      }

      //Donna Start
      if (this.options.showCustom) {
        this.$element.append('<option value="Custom">Use Custom Font</option>');
      }

      if (this.options.showMore) {
        this.$element.append('<option value="Google">More Fonts...</option>');
      }
      //Donna End

      this.$element.val(value);
    },

    addBootstrapFonts: function() {
      var $input,
          $toggle,
          $options,
          value,
          font,
          fonts;

      value = this.options.font;
      $input = this.$element.find('input[type="hidden"]');
      $toggle = this.$element.find('.bfh-selectbox-option');
      $options = this.$element.find('[role=option]');
      fonts = this.getFonts();

      $options.html('');

      if (this.options.blank === true) {
        $options.append('<li><a tabindex="-1" href="#" data-option=""></a></li>');
      }

      for (font in fonts) {
        if (fonts.hasOwnProperty(font)) {
          $options.append('<li><a tabindex="-1" href="#" style=\'font-family: ' + fonts[font] + '\' data-option="' + font + '">' + font + '</a></li>');
        }
      }

      //Donna Start
      if (this.options.showCustom) {
        $options.append('<li><a tabindex="-1" href="#" style=\'font-family: Custom\' data-option="Use Custom Font">Use Custom Font</a></li>');
      }

      if (this.options.showMore) {
        $options.append('<li><a tabindex="-1" href="#" style=\'font-family: Google\' data-option="More Fonts...">More Fonts...</a></li>');
      }
      //Donna End

      this.$element.val(value);
    }

  };


  /* FONTS PLUGIN DEFINITION
   * ======================= */

  var old = $.fn.bfhfonts;

  $.fn.bfhfonts = function (option) {
    return this.each(function () {
      var $this,
          data,
          options;

      $this = $(this);
      data = $this.data('bfhfonts');
      options = typeof option === 'object' && option;

      if (!data) {
        $this.data('bfhfonts', (data = new BFHFonts(this, options)));
      }
      if (typeof option === 'string') {
        data[option].call($this);
      }
    });
  };

  $.fn.bfhfonts.Constructor = BFHFonts;

  $.fn.bfhfonts.defaults = {
    font: '',
    available: '',
    blank: true,
    showCustom : false, //Donna
    showMore : false	//Donna
  };


  /* FONTS NO CONFLICT
   * ========================== */

  $.fn.bfhfonts.noConflict = function () {
    $.fn.bfhfonts = old;
    return this;
  };


  /* FONTS DATA-API
   * ============== */

  $(document).ready( function () {
    $('form select.bfh-fonts, span.bfh-fonts, div.bfh-fonts').each(function () {
      var $fonts;

      $fonts = $(this);

      if ($fonts.hasClass('bfh-selectbox')) {
        $fonts.bfhselectbox($fonts.data());
      }
      $fonts.bfhfonts($fonts.data());
    });
  });

}(window.jQuery);

/* ==========================================================
 * bootstrap-formhelpers-fontsizes.js
 * https://github.com/vlamanna/BootstrapFormHelpers
 * ==========================================================
 * Copyright 2012 Vincent Lamanna
 * contributed by Aaron Collegeman, Squidoo, 2012
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */

+function ($) {

  'use strict';


  /* FONTSIZES CLASS DEFINITION
   * ====================== */

  var BFHFontSizes = function (element, options) {
    this.options = $.extend({}, $.fn.bfhfontsizes.defaults, options);
    this.$element = $(element);

    if (this.$element.is('select')) {
      this.addFontSizes();
    }

    if (this.$element.hasClass('bfh-selectbox')) {
      this.addBootstrapFontSizes();
    }
  };

  BFHFontSizes.prototype = {

    constructor: BFHFontSizes,

    getFontsizes: function() {
      var fontsize,
          fontsizes;

      if (this.options.available) {
        fontsizes = [];

        this.options.available = this.options.available.split(',');

        for (fontsize in BFHFontSizesList) {
          if (BFHFontSizesList.hasOwnProperty(fontsize)) {
            if ($.inArray(fontsize, this.options.available) >= 0) {
              fontsizes[fontsize] = BFHFontSizesList[fontsize];
            }
          }
        }

        return fontsizes;
      } else {
        return BFHFontSizesList;
      }
    },

    addFontSizes: function () {
      var value,
          fontsize,
          fontsizes;

      value = this.options.fontsize;
      fontsizes = this.getFontsizes();

      this.$element.html('');

      if (this.options.blank === true) {
        this.$element.append('<option value=""></option>');
      }

      for (fontsize in fontsizes) {
        if (fontsizes.hasOwnProperty(fontsize)) {
          this.$element.append('<option value="' + fontsize + '">' + fontsizes[fontsize] + '</option>');
        }
      }

      this.$element.val(value);
    },

    addBootstrapFontSizes: function() {
      var $input,
          $toggle,
          $options,
          value,
          fontsize,
          fontsizes;

      value = this.options.fontsize;
      $input = this.$element.find('input[type="hidden"]');
      $toggle = this.$element.find('.bfh-selectbox-option');
      $options = this.$element.find('[role=option]');
      fontsizes = this.getFontsizes();

      $options.html('');

      if (this.options.blank === true) {
        $options.append('<li><a tabindex="-1" href="#" data-option=""></a></li>');
      }

      for (fontsize in fontsizes) {
        if (fontsizes.hasOwnProperty(fontsize)) {
          $options.append('<li><a tabindex="-1" href="#" data-option="' + fontsize + '">' + fontsizes[fontsize] + '</a></li>');
        }
      }

      this.$element.val(value);
    }

  };


  /* FONTSIZES PLUGIN DEFINITION
   * ======================= */

  var old = $.fn.bfhfontsizes;

  $.fn.bfhfontsizes = function (option) {
    return this.each(function () {
      var $this,
          data,
          options;

      $this = $(this);
      data = $this.data('bfhfontsizes');
      options = typeof option === 'object' && option;

      if (!data) {
        $this.data('bfhfontsizes', (data = new BFHFontSizes(this, options)));
      }
      if (typeof option === 'string') {
        data[option].call($this);
      }
    });
  };

  $.fn.bfhfontsizes.Constructor = BFHFontSizes;

  $.fn.bfhfontsizes.defaults = {
    fontsize: '',
    available: '',
    blank: true
  };


  /* FONTSIZES NO CONFLICT
   * ========================== */

  $.fn.bfhfontsizes.noConflict = function () {
    $.fn.bfhfontsizes = old;
    return this;
  };


  /* FONTSIZES DATA-API
   * ============== */

  $(document).ready( function () {
    $('form select.bfh-fontsizes, span.bfh-fontsizes, div.bfh-fontsizes').each(function () {
      var $fontSizes;

      $fontSizes = $(this);

      if ($fontSizes.hasClass('bfh-selectbox')) {
        $fontSizes.bfhselectbox($fontSizes.data());
      }
      $fontSizes.bfhfontsizes($fontSizes.data());
    });
  });

}(window.jQuery);

/* ==========================================================
 * bootstrap-formhelpers-googlefonts.js
 * https://github.com/vlamanna/BootstrapFormHelpers
 * ==========================================================
 * Copyright 2012 Vincent Lamanna
 * contributed by Aaron Collegeman, Squidoo, 2012
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */

+function ($) {

  'use strict';


  /* GOOGLE FONTS CLASS DEFINITION
   * ====================== */

  var BFHGoogleFonts = function (element, options) {
    this.options = $.extend({}, $.fn.bfhgooglefonts.defaults, options);
    this.$element = $(element);

    if (this.$element.is('select')) {
      this.addFonts();
    }

    if (this.$element.hasClass('bfh-selectbox')) {
      this.addBootstrapFonts();
    }
  };

  BFHGoogleFonts.prototype = {

    constructor: BFHGoogleFonts,

    getFonts: function() {
      var font,
          fonts;

      fonts = [];

      if (this.options.subset) {
        for (font in BFHGoogleFontsList.items) {
          if (BFHGoogleFontsList.items.hasOwnProperty(font)) {
            if ($.inArray(this.options.subset, BFHGoogleFontsList.items[font].subsets) >= 0) {
              fonts[BFHGoogleFontsList.items[font].family] = {
                'info': BFHGoogleFontsList.items[font],
                'index': parseInt(font, 10)
              };
            }
          }
        }
      } else if (this.options.available) {
        this.options.available = this.options.available.split(',');

        for (font in BFHGoogleFontsList.items) {
          if (BFHGoogleFontsList.items.hasOwnProperty(font)) {
            if ($.inArray(BFHGoogleFontsList.items[font].family, this.options.available) >= 0) {
              fonts[BFHGoogleFontsList.items[font].family] = {
                'info': BFHGoogleFontsList.items[font],
                'index': parseInt(font, 10)
              };
            }
          }
        }
      } else {
        for (font in BFHGoogleFontsList.items) {
          if (BFHGoogleFontsList.items.hasOwnProperty(font)) {
            fonts[BFHGoogleFontsList.items[font].family] = {
              'info': BFHGoogleFontsList.items[font],
              'index': parseInt(font, 10)
            };
          }
        }
      }

      return fonts;
    },

    addFonts: function () {
      var value,
          font,
          fonts;

      value = this.options.font;
      fonts = this.getFonts();

      this.$element.html('');

      if (this.options.blank === true) {
        this.$element.append('<option value=""></option>');
      }

      for (font in fonts) {
        if (fonts.hasOwnProperty(font)) {
          this.$element.append('<option value="' + fonts[font].info.family + '">' + fonts[font].info.family + '</option>');
        }
      }

      //Donna Start
      if (this.options.showCustom) {
        this.$element.append('<option value="Custom">Use Custom Font</option>');
      }

      if (this.options.showMore) {
        this.$element.append('<option value="Google">More Fonts...</option>');
      }
      //Donna End

      this.$element.val(value);
    },

    addBootstrapFonts: function() {
      var $input,
          $toggle,
          $options,
          value,
          font,
          fonts;

      value = this.options.font;
      $input = this.$element.find('input[type="hidden"]');
      $toggle = this.$element.find('.bfh-selectbox-option');
      $options = this.$element.find('[role=option]');
      fonts = this.getFonts();

      $options.html('');

      if (this.options.blank === true) {
        $options.append('<li><a tabindex="-1" href="#" data-option="" style="background-image: none;"></a></li>');
      }

      for (font in fonts) {
        if (fonts.hasOwnProperty(font)) {
          $options.append('<li><a tabindex="-1" href="#" style="background-position: 0 -' + ((fonts[font].index * 30) - 2) + 'px;" data-option="' + fonts[font].info.family + '">' + fonts[font].info.family + '</a></li>');
        }
      }

      //Donna Start
      if (this.options.showCustom) {
        $options.append('<li><a tabindex="-1" href="#" style=\'font-family: Custom\' data-option="Use Custom Font">Use Custom Font</a></li>');
      }

      if (this.options.showMore) {
        $options.append('<li><a tabindex="-1" href="#" style=\'font-family: Google\' data-option="More Fonts...">More Fonts...</a></li>');
      }
      //Donna End

      this.$element.val(value);
    }

  };


  /* GOOGLE FONTS PLUGIN DEFINITION
   * ======================= */

  var old = $.fn.bfhgooglefonts;

  $.fn.bfhgooglefonts = function (option) {
    return this.each(function () {
      var $this,
          data,
          options;

      $this = $(this);
      data = $this.data('bfhgooglefonts');
      options = typeof option === 'object' && option;

      if (!data) {
        $this.data('bfhgooglefonts', (data = new BFHGoogleFonts(this, options)));
      }
      if (typeof option === 'string') {
        data[option].call($this);
      }
    });
  };

  $.fn.bfhgooglefonts.Constructor = BFHGoogleFonts;

  $.fn.bfhgooglefonts.defaults = {
    font: '',
    available: '',
    subset: '',
    blank: true
  };


  /* GOOGLE FONTS NO CONFLICT
   * ========================== */

  $.fn.bfhgooglefonts.noConflict = function () {
    $.fn.bfhgooglefonts = old;
    return this;
  };


  /* GOOGLE FONTS DATA-API
   * ============== */

  $(document).ready( function () {
    $('form select.bfh-googlefonts, span.bfh-googlefonts, div.bfh-googlefonts').each(function () {
      var $googleFonts;

      $googleFonts = $(this);

      if ($googleFonts.hasClass('bfh-selectbox')) {
        $googleFonts.bfhselectbox($googleFonts.data());
      }
      $googleFonts.bfhgooglefonts($googleFonts.data());
    });
  });

}(window.jQuery);

/* Donna Start */
! function($) {

  'use strict';

  /* FONT LIST CLASS DEFINITION
   * ====================== */

  var BFHGoogleFontList = function(element, options) {
    var i, f, font, allhave;

    this.options = $.extend({}, $.fn.bfhgooglefontlist.defaults, options);
    this.$element = $(element);
    this.familyList = {};

    for (i in BFHGoogleFontsList.items) {
      if (BFHGoogleFontsList.items.hasOwnProperty(i)) {
        font = BFHGoogleFontsList.items[i];
        this.familyList[font.family] = {
          'font' : BFHGoogleFontsList.items[i],
          'i' : parseInt(i, 10)
        };
      }
    }

    this.addFonts();
  };

  BFHGoogleFontList.prototype = {

    constructor : BFHGoogleFontList,

    addFonts : function() {
      var value, f, $item, entry, self = this;

      value = this.options.family;

      this.$element.html('');
      var bindMe = function(e) {
        e.preventDefault();
        self.$element.trigger('select', $(this).data('option'));
      };
      for (f in this.familyList) {
        if (this.familyList.hasOwnProperty(f)) {
          entry = this.familyList[f];
          $item = $('<a href="#" class="list-group-item" style="background-position: 0 -' + ((entry.i * 30) - 2) + 'px;" data-option="' + entry.font.family + '">' + entry.font.family + '</a>');

          $item.bind('click', bindMe);
          this.$element.append($item);
        }
      }
    }
  };

  /* FONT LIST PLUGIN DEFINITION
   * ======================= */

  $.fn.bfhgooglefontlist = function(option) {
    return this.each(function() {
      var $this, data, options;

      $this = $(this);
      data = $this.data('bfhgooglefontlist');
      options = typeof option === 'object' && option;
      this.type = 'bfhgooglefontlist';

      if (!data) {
        $this.data('bfhgooglefontlist', ( data = new BFHGoogleFontList(this, options)));
      }
      if ( typeof option === 'string') {
        data[option]();
      }
    });
  };

  $.fn.bfhgooglefontlist.Constructor = BFHGoogleFontList;

  $.fn.bfhgooglefontlist.defaults = {
    family : ''
  };

  /* FONT LIST DATA-API
   * ============== */

  $(window).on('load', function() {
    $('div.bfh-googlefontlist').each(function() {
      var $googleFontList;

      $googleFontList = $(this);

      $googleFontList.bfhgooglefontlist($googleFontList.data());
    });
  });

}(window.jQuery);
/* Donna End */

/* ==========================================================
 * bootstrap-formhelpers-languages.js
 * https://github.com/vlamanna/BootstrapFormHelpers
 * ==========================================================
 * Copyright 2012 Vincent Lamanna
 * Contribution 2013 Tomasz Kuter
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */

+function ($) {

  'use strict';


  /* LANGUAGES CLASS DEFINITION
   * ====================== */

  var BFHLanguages = function (element, options) {
    this.options = $.extend({}, $.fn.bfhlanguages.defaults, options);
    this.$element = $(element);

    if (this.$element.is('select')) {
      this.addLanguages();
    }

    if (this.$element.is('span')) {
      this.displayLanguage();
    }

    if (this.$element.hasClass('bfh-selectbox')) {
      this.addBootstrapLanguages();
    }
  };

  BFHLanguages.prototype = {

    constructor: BFHLanguages,

    getLanguages: function () {
      var split,
          language,
          languages;

      if (this.options.available) {
        languages = [];

        this.options.available = this.options.available.split(',');

        for (language in this.options.available) {
          if (this.options.available.hasOwnProperty(language)) {
            if (this.options.available[language].indexOf('_') !== -1) {
              split = this.options.available[language].split('_');
              languages[split[0]] = {name: BFHLanguagesList[split[0]], country: split[1]};
            } else {
              languages[this.options.available[language]] = BFHLanguagesList[this.options.available[language]];
            }
          }
        }

        return languages;
      } else {
        return BFHLanguagesList;
      }
    },

    addLanguages: function () {
      var split,
          value,
          languages,
          language;

      value = this.options.language;
      languages = this.getLanguages();

      this.$element.html('');

      if (this.options.blank === true) {
        this.$element.append('<option value=""></option>');
      }

      for (language in languages) {
        if (languages.hasOwnProperty(language)) {
          if (languages[language].hasOwnProperty('name')) {
            this.$element.append('<option value="' + language + '_' + languages[language].country + '">' + languages[language].name.toProperCase() + ' (' + BFHCountriesList[languages[language].country] + ')</option>');
          } else {
            this.$element.append('<option value="' + language + '">' + languages[language].toProperCase() + '</option>');
          }
        }
      }

      this.$element.val(value);
    },

    addBootstrapLanguages: function() {
      var $input,
          $toggle,
          $options,
          value,
          languages,
          language,
          split;

      value = this.options.language;
      $input = this.$element.find('input[type="hidden"]');
      $toggle = this.$element.find('.bfh-selectbox-option');
      $options = this.$element.find('[role=option]');
      languages = this.getLanguages();

      $options.html('');

      if (this.options.blank === true) {
        $options.append('<li><a tabindex="-1" href="#" data-option=""></a></li>');
      }

      for (language in languages) {
        if (languages.hasOwnProperty(language)) {
          if (languages[language].hasOwnProperty('name')) {
            if (this.options.flags === true) {
              $options.append('<li><a tabindex="-1" href="#" data-option="' + language + '_' + languages[language].country + '"><i class="glyphicon bfh-flag-' + languages[language].country + '"></i>' + languages[language].name.toProperCase() + '</a></li>');
            } else {
              $options.append('<li><a tabindex="-1" href="#" data-option="' + language + '_' + languages[language].country + '">' + languages[language].name.toProperCase() + ' (' + BFHCountriesList[languages[language].country] + ')</a></li>');
            }
          } else {
            $options.append('<li><a tabindex="-1" href="#" data-option="' + language + '">' + languages[language] + '</a></li>');
          }
        }
      }

      this.$element.val(value);
    },

    displayLanguage: function () {
      var value;

      value = this.options.language;

      if (value.indexOf('_') !== -1) {
        value = value.split('_');
        if (this.options.flags === true) {
          this.$element.html('<i class="glyphicon bfh-flag-' + value[1] + '"></i> ' + BFHLanguagesList[value[0]].toProperCase());
        } else {
          this.$element.html(BFHLanguagesList[value[0]].toProperCase() + ' (' + BFHCountriesList[value[1]] + ')');
        }
      } else {
        this.$element.html(BFHLanguagesList[value].toProperCase());
      }
    }

  };


  /* LANGUAGES PLUGIN DEFINITION
   * ======================= */

  var old = $.fn.bfhlanguages;

  $.fn.bfhlanguages = function (option) {
    return this.each(function () {
      var $this,
          data,
          options;

      $this = $(this);
      data = $this.data('bfhlanguages');
      options = typeof option === 'object' && option;

      if (!data) {
        $this.data('bfhlanguages', (data = new BFHLanguages(this, options)));
      }
      if (typeof option === 'string') {
        data[option].call($this);
      }
    });
  };

  $.fn.bfhlanguages.Constructor = BFHLanguages;

  $.fn.bfhlanguages.defaults = {
    language: '',
    available: '',
    flags: false,
    blank: true
  };


  /* LANGUAGES NO CONFLICT
   * ========================== */

  $.fn.bfhlanguages.noConflict = function () {
    $.fn.bfhlanguages = old;
    return this;
  };


  /* LANGUAGES DATA-API
   * ============== */

  $(document).ready( function () {
    $('form select.bfh-languages, span.bfh-languages, div.bfh-languages').each(function () {
      var $languages;

      $languages = $(this);

      if ($languages.hasClass('bfh-selectbox')) {
        $languages.bfhselectbox($languages.data());
      }
      $languages.bfhlanguages($languages.data());
    });
  });


  /* LANGUAGES HELPERS
   * ============== */

  String.prototype.toProperCase = function () {
    return this.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
  };

}(window.jQuery);

/* ==========================================================
 * bootstrap-formhelpers-number.js
 * https://github.com/vlamanna/BootstrapFormHelpers
 * ==========================================================
 * Copyright 2012 Vincent Lamanna
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */

+function ($) {

  'use strict';


  /* NUMBER CLASS DEFINITION
   * ====================== */

  var BFHNumber = function (element, options) {
    this.options = $.extend({}, $.fn.bfhnumber.defaults, options);
    this.$element = $(element);

    this.initInput();
  };

  BFHNumber.prototype = {

    constructor: BFHNumber,

    initInput: function() {
      var value;
      
      if (this.options.buttons === true) {
        this.$element.wrap('<div class="input-group"></div>');
        this.$element.parent().append('<span class="input-group-addon bfh-number-btn inc"><span class="glyphicon glyphicon-chevron-up"></span></span>');
        this.$element.parent().append('<span class="input-group-addon bfh-number-btn dec"><span class="glyphicon glyphicon-chevron-down"></span></span>');
      }
      
      this.$element.on('change.bfhnumber.data-api', BFHNumber.prototype.change);
        
      if (this.options.keyboard === true) {
        this.$element.on('keydown.bfhnumber.data-api', BFHNumber.prototype.keydown);
      }
      
      if (this.options.buttons === true) {
        this.$element.parent()
          .on('mousedown.bfhnumber.data-api', '.inc', BFHNumber.prototype.btninc)
          .on('mousedown.bfhnumber.data-api', '.dec', BFHNumber.prototype.btndec);
      }
      
      this.formatNumber();
    },
    
    keydown: function(e) {
      var $this;
      
      $this = $(this).data('bfhnumber');
      
      if ($this.$element.is('.disabled') || $this.$element.attr('disabled') !== undefined) {
        return true;
      }
      
      switch (e.which) {
        case 38:
          $this.increment();
          break;
        case 40:
          $this.decrement();
          break;
        default:
      }
      
      return true;
    },
    
    mouseup: function(e) {
      var $this,
          timer,
          interval;
      
      $this = e.data.btn;
      timer = $this.$element.data('timer');
      interval = $this.$element.data('interval');
      
      clearTimeout(timer);
      clearInterval(interval);
    },
    
    btninc: function() {
      var $this,
          timer;
      
      $this = $(this).parent().find('.bfh-number').data('bfhnumber');
      
      if ($this.$element.is('.disabled') || $this.$element.attr('disabled') !== undefined) {
        return true;
      }
      
      $this.increment();
      
      timer = setTimeout(function() {
        var interval;
        interval = setInterval(function() {
          $this.increment();
        }, 80);
        $this.$element.data('interval', interval);
      }, 750);
      $this.$element.data('timer', timer);
      
      $(document).one('mouseup', {btn: $this}, BFHNumber.prototype.mouseup);
      
      return true;
    },
    
    btndec: function() {
      var $this,
          timer;
      
      $this = $(this).parent().find('.bfh-number').data('bfhnumber');
      
      if ($this.$element.is('.disabled') || $this.$element.attr('disabled') !== undefined) {
        return true;
      }
      
      $this.decrement();
      
      timer = setTimeout(function() {
        var interval;
        interval = setInterval(function() {
          $this.decrement();
        }, 80);
        $this.$element.data('interval', interval);
      }, 750);
      $this.$element.data('timer', timer);
      
      $(document).one('mouseup', {btn: $this}, BFHNumber.prototype.mouseup);
      
      return true;
    },
    
    change: function() {
      var $this;

      $this = $(this).data('bfhnumber');

      if ($this.$element.is('.disabled') || $this.$element.attr('disabled') !== undefined) {
        return true;
      }

      $this.formatNumber();

      return true;
    },
    
    increment: function() {
      var value;
      
      value = this.getValue();
      
      value = value + 1;
      
      this.$element.val(value).change();
    },
    
    decrement: function() {
      var value;
      
      value = this.getValue();
      
      value = value - 1;
      
      this.$element.val(value).change();
    },
    
    getValue: function() {
      var value;
      
      value = this.$element.val();
      if (value !== '-1') {
        value = String(value).replace(/\D/g, '');
      }
      if (String(value).length === 0) {
        value = this.options.min;
      }
      
      return parseInt(value);
    },
    
    formatNumber: function() {
      var value,
          maxLength,
          length,
          zero;
      
      value = this.getValue();
      
      if (value > this.options.max) {
        if (this.options.wrap === true) {
          value = this.options.min;
        } else {
          value = this.options.max;
        }
      }
      
      if (value < this.options.min) {
        if (this.options.wrap === true) {
          value = this.options.max;
        } else {
          value = this.options.min;
        }
      }
      
      if (this.options.zeros === true) {
        maxLength = String(this.options.max).length;
        length = String(value).length;
        for (zero=length; zero < maxLength; zero = zero + 1) {
          value = '0' + value;
        }
      }
      
      if (value !== this.$element.val()) {
        this.$element.val(value);
      }
    }

  };

  /* NUMBER PLUGIN DEFINITION
   * ======================= */

  var old = $.fn.bfhnumber;

  $.fn.bfhnumber = function (option) {
    return this.each(function () {
      var $this,
          data,
          options;

      $this = $(this);
      data = $this.data('bfhnumber');
      options = typeof option === 'object' && option;

      if (!data) {
        $this.data('bfhnumber', (data = new BFHNumber(this, options)));
      }
      if (typeof option === 'string') {
        data[option].call($this);
      }
    });
  };

  $.fn.bfhnumber.Constructor = BFHNumber;

  $.fn.bfhnumber.defaults = {
    min: 0,
    max: 9999,
    zeros: false,
    keyboard: true,
    buttons: true,
    wrap: false
  };


  /* NUMBER NO CONFLICT
   * ========================== */

  $.fn.bfhnumber.noConflict = function () {
    $.fn.bfhnumber = old;
    return this;
  };


  /* NUMBER DATA-API
   * ============== */

  $(document).ready( function () {
    $('form input[type="text"].bfh-number, form input[type="number"].bfh-number').each(function () {
      var $number;

      $number = $(this);

      $number.bfhnumber($number.data());
    });
  });


  /* APPLY TO STANDARD NUMBER ELEMENTS
   * =================================== */


}(window.jQuery);

/* ==========================================================
 * bootstrap-formhelpers-phone.js
 * https://github.com/vlamanna/BootstrapFormHelpers
 * ==========================================================
 * Copyright 2012 Vincent Lamanna
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */

+function ($) {

  'use strict';


  /* PHONE CLASS DEFINITION
   * ====================== */

  var BFHPhone = function (element, options) {
    this.options = $.extend({}, $.fn.bfhphone.defaults, options);
    this.$element = $(element);

    if (this.$element.is('input[type="text"]') || this.$element.is('input[type="tel"]')) {
      this.addFormatter();
    }

    if (this.$element.is('span')) {
      this.displayFormatter();
    }
  };

  BFHPhone.prototype = {

    constructor: BFHPhone,

    addFormatter: function() {
      var $country;

      if (this.options.country !== '') {
        $country = $(document).find('#' + this.options.country);

        if ($country.length !== 0) {
          this.options.format = BFHPhoneFormatList[$country.val()];
          $country.on('change', {phone: this}, this.changeCountry);
        } else {
          this.options.format = BFHPhoneFormatList[this.options.country];
        }
      }
      
      this.$element.on('keyup.bfhphone.data-api', BFHPhone.prototype.change);

      this.loadFormatter();
    },

    loadFormatter: function () {
      var formattedNumber;

      formattedNumber = formatNumber(this.options.format, this.$element.val());

      this.$element.val(formattedNumber);
    },

    displayFormatter: function () {
      var formattedNumber;

      if (this.options.country !== '') {
        this.options.format = BFHPhoneFormatList[this.options.country];
      }

      formattedNumber = formatNumber(this.options.format, this.options.number);

      this.$element.html(formattedNumber);
    },

    changeCountry: function (e) {
      var $this,
          $phone;

      $this = $(this);
      $phone = e.data.phone;

      $phone.$element.val(String($phone.$element.val()).replace(/\+\d*/g, ''));
      $phone.options.format = BFHPhoneFormatList[$this.val()];

      $phone.loadFormatter();
    },

    change: function(e) {
      var $this,
          cursorPosition,
          cursorEnd,
          formattedNumber;

      $this = $(this).data('bfhphone');

      if ($this.$element.is('.disabled') || $this.$element.attr('disabled') !== undefined) {
        return true;
      }

      cursorPosition = getCursorPosition($this.$element[0]);

      cursorEnd = false;
      if (cursorPosition === $this.$element.val().length) {
        cursorEnd = true;
      }
      
      if (e.which === 8 && $this.options.format.charAt($this.$element.val().length) !== 'd') {
        $this.$element.val(String($this.$element.val()).substring(0, $this.$element.val().length - 1));
      }

      formattedNumber = formatNumber($this.options.format, $this.$element.val());
      
      if (formattedNumber === $this.$element.val()) {
        return true;
      }
      
      $this.$element.val(formattedNumber);

      if (cursorEnd) {
        cursorPosition = $this.$element.val().length;
      }

      setCursorPosition($this.$element[0], cursorPosition);

      return true;
    }

  };

  function formatNumber(format, number) {
    var formattedNumber,
        indexFormat,
        indexNumber,
        lastCharacter;

    formattedNumber = '';
    number = String(number).replace(/\D/g, '');

    for (indexFormat = 0, indexNumber = 0; indexFormat < format.length; indexFormat = indexFormat + 1) {
      if (/\d/g.test(format.charAt(indexFormat))) {
        if (format.charAt(indexFormat) === number.charAt(indexNumber)) {
          formattedNumber += number.charAt(indexNumber);
          indexNumber = indexNumber + 1;
        } else {
          formattedNumber += format.charAt(indexFormat);
        }
      } else if (format.charAt(indexFormat) !== 'd') {
        if (number.charAt(indexNumber) !== '' || format.charAt(indexFormat) === '+') {
          formattedNumber += format.charAt(indexFormat);
        }
      } else {
        if (number.charAt(indexNumber) === '') {
          formattedNumber += '';
        } else {
          formattedNumber += number.charAt(indexNumber);
          indexNumber = indexNumber + 1;
        }
      }
    }
    
    lastCharacter = format.charAt(formattedNumber.length);
    if (lastCharacter !== 'd') {
      formattedNumber += lastCharacter;
    }

    return formattedNumber;
  }

  function getCursorPosition($element) {
    var position = 0,
        selection;

    if (document.selection) {
      // IE Support
      $element.focus();
      selection = document.selection.createRange();
      selection.moveStart ('character', -$element.value.length);
      position = selection.text.length;
    } else if ($element.selectionStart || $element.selectionStart === 0) {
      position = $element.selectionStart;
    }

    return position;
  }

  function setCursorPosition($element, position) {
    var selection;

    if (document.selection) {
      // IE Support
      $element.focus ();
      selection = document.selection.createRange();
      selection.moveStart ('character', -$element.value.length);
      selection.moveStart ('character', position);
      selection.moveEnd ('character', 0);
      selection.select ();
    } else if ($element.selectionStart || $element.selectionStart === 0) {
      $element.selectionStart = position;
      $element.selectionEnd = position;
      $element.focus ();
    }
  }

  /* PHONE PLUGIN DEFINITION
   * ======================= */

  var old = $.fn.bfhphone;

  $.fn.bfhphone = function (option) {
    return this.each(function () {
      var $this,
          data,
          options;

      $this = $(this);
      data = $this.data('bfhphone');
      options = typeof option === 'object' && option;

      if (!data) {
        $this.data('bfhphone', (data = new BFHPhone(this, options)));
      }
      if (typeof option === 'string') {
        data[option].call($this);
      }
    });
  };

  $.fn.bfhphone.Constructor = BFHPhone;

  $.fn.bfhphone.defaults = {
    format: '',
    number: '',
    country: ''
  };


  /* PHONE NO CONFLICT
   * ========================== */

  $.fn.bfhphone.noConflict = function () {
    $.fn.bfhphone = old;
    return this;
  };


  /* PHONE DATA-API
   * ============== */

  $(document).ready( function () {
    $('form input[type="text"].bfh-phone, form input[type="tel"].bfh-phone, span.bfh-phone').each(function () {
      var $phone;

      $phone = $(this);

      $phone.bfhphone($phone.data());
    });
  });

}(window.jQuery);

/* ==========================================================
 * bootstrap-formhelpers-selectbox.js
 * https://github.com/vlamanna/BootstrapFormHelpers
 * ==========================================================
 * Copyright 2012 Vincent Lamanna
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */

+function ($) {

  'use strict';


  /* SELECTBOX CLASS DEFINITION
   * ========================= */

  var toggle = '[data-toggle=bfh-selectbox]',
      BFHSelectBox = function (element, options) {
        this.options = $.extend({}, $.fn.bfhselectbox.defaults, options);
        this.$element = $(element);

        this.initSelectBox();
      };

  BFHSelectBox.prototype = {

    constructor: BFHSelectBox,

    initSelectBox: function () {
      var options;

      options = '';

      //This is a temporary hack: used for custom templates
      if(this.$element.find('.bfh-selectbox-options').length === 0) { //Xiyang
        this.$element.find('div').each(function() {
          options = options + '<li><a tabindex="-1" href="#" data-option="' + $(this).data('value') + '">' + $(this).html() + '</a></li>';
        });

        this.$element.html(
          '<input type="hidden" name="' + this.options.name + '" value="">' +
        '<a class="bfh-selectbox-toggle ' + this.options.input + '" role="button" data-toggle="bfh-selectbox" href="#">' +
        '<span class="bfh-selectbox-option"></span>' +
        '<span class="' + this.options.icon + ' selectbox-caret"></span>' +
        '</a>' +
        '<div class="bfh-selectbox-options">' +
        '<div role="listbox">' +
        '<ul role="option">' +
        '</ul>' +
        '</div>' +
        '</div>'
        );

        this.$element.find('[role=option]').html(options);

        if (this.options.filter === true) {
          this.$element.find('.bfh-selectbox-options').prepend('<div class="bfh-selectbox-filter-container"><input type="text" class="bfh-selectbox-filter form-control"></div>');
        }

        this.$element.val(this.options.value);

      } //Xiyang

      this.$element
        .on('click.bfhselectbox.data-api touchstart.bfhselectbox.data-api', toggle, BFHSelectBox.prototype.toggle)
		.on('keydown.bfhselectbox.data-api', toggle + ', [role=option]' , BFHSelectBox.prototype.keydown)
		.on('mouseenter.bfhselectbox.data-api', '[role=option] > li > a', BFHSelectBox.prototype.mouseenter)
		.on('click.bfhselectbox.data-api', '[role=option] > li > a', BFHSelectBox.prototype.select)
		.on('click.bfhselectbox.data-api', '.bfh-selectbox-filter', function () { return false; })
		.on('propertychange.bfhselectbox.data-api change.bfhselectbox.data-api input.bfhselectbox.data-api paste.bfhselectbox.data-api', '.bfh-selectbox-filter', BFHSelectBox.prototype.filter);
    },

    toggle: function (e) {
      var $this,
          $parent,
          isActive;

      $this = $(this);
      $parent = getParent($this);

      if ($parent.is('.disabled') || $parent.attr('disabled') !== undefined) {
        return true;
      }

      isActive = $parent.hasClass('open');

      clearMenus();

      if (!isActive) {
        $parent.trigger(e = $.Event('show.bfhselectbox'));

        if (e.isDefaultPrevented()) {
          return true;
        }

        $parent
          .toggleClass('open')
          .trigger('shown.bfhselectbox')
          .find('[role=option] > li > [data-option="' + $parent.val() + '"]').focus();
      }

      return false;
    },

    filter: function() {
      var $this,
          $parent,
          $items;

      $this = $(this);
      $parent = getParent($this);

      $items = $('[role=option] li a', $parent);
      $items
        .hide()
        .filter(function() {
          return ($(this).text().toUpperCase().indexOf($this.val().toUpperCase()) !== -1);
        })
        .show();
    },

    keydown: function (e) {
      var $this,
          $items,
          $parent,
          $subItems,
          isActive,
          index,
          selectedIndex;

      if (!/(38|40|27)/.test(e.keyCode)) {
        return true;
      }

      $this = $(this);

      e.preventDefault();
      e.stopPropagation();

      $parent = getParent($this);
      isActive = $parent.hasClass('open');

      if (!isActive || (isActive && e.keyCode === 27)) {
        if (e.which === 27) {
          $parent.find(toggle).focus();
        }

        return $this.click();
      }

      $items = $('[role=option] li:not(.divider) a:visible', $parent);

      if (!$items.length) {
        return true;
      }

      $('body').off('mouseenter.bfh-selectbox.data-api', '[role=option] > li > a', BFHSelectBox.prototype.mouseenter);
      index = $items.index($items.filter(':focus'));

      if (e.keyCode === 38 && index > 0) {
        index = index - 1;
      }

      if (e.keyCode === 40 && index < $items.length - 1) {
        index = index + 1;
      }

      if (!index) {
        index = 0;
      }

      $items.eq(index).focus();
      $('body').on('mouseenter.bfh-selectbox.data-api', '[role=option] > li > a', BFHSelectBox.prototype.mouseenter);
    },

    mouseenter: function () {
      var $this;

      $this = $(this);

      $this.focus();
    },

    select: function (e) {
      var $this,
          $parent,
          $span,
          $input;

      $this = $(this);

      e.preventDefault();
      e.stopPropagation();

      if ($this.is('.disabled') || $this.attr('disabled') !== undefined) {
        return true;
      }

      $parent = getParent($this);

      $parent.val($this.data('option'));
      $parent.trigger('change.bfhselectbox');

      clearMenus();
    }

  };

  function clearMenus() {
    var $parent;

    $(toggle).each(function (e) {
      $parent = getParent($(this));

      if (!$parent.hasClass('open')) {
        return true;
      }

      $parent.trigger(e = $.Event('hide.bfhselectbox'));

      if (e.isDefaultPrevented()) {
        return true;
      }

      $parent
        .removeClass('open')
        .trigger('hidden.bfhselectbox');
    });
  }

  function getParent($this) {
    return $this.closest('.bfh-selectbox');
  }


  /* SELECTBOX PLUGIN DEFINITION
   * ========================== */

  var old = $.fn.bfhselectbox;

  $.fn.bfhselectbox = function (option) {
    return this.each(function () {
      var $this,
          data,
          options;

      $this = $(this);
      data = $this.data('bfhselectbox');
      options = typeof option === 'object' && option;
      this.type = 'bfhselectbox';

      if (!data) {
        $this.data('bfhselectbox', (data = new BFHSelectBox(this, options)));
      }
      if (typeof option === 'string') {
        data[option].call($this);
      }
    });
  };

  $.fn.bfhselectbox.Constructor = BFHSelectBox;

  $.fn.bfhselectbox.defaults = {
    icon: 'caret',
    input: 'form-control',
    name: '',
    value: '',
    filter: false
  };


  /* SELECTBOX NO CONFLICT
   * ========================== */

  $.fn.bfhselectbox.noConflict = function () {
    $.fn.bfhselectbox = old;
    return this;
  };


  /* SELECTBOX VALHOOKS
   * ========================== */

  var origHook;
  if ($.valHooks.div){
    origHook = $.valHooks.div;
  }
  $.valHooks.div = {
    get: function(el) {
      if ($(el).hasClass('bfh-selectbox')) {
        return $(el).find('input[type="hidden"]').val();
      } else if (origHook) {
        return origHook.get(el);
      }
    },
    set: function(el, val) {
      var $el,
          html;

      if ($(el).hasClass('bfh-selectbox')) {

        $el = $(el);
        if ($el.find('li a[data-option=\'' + val + '\']').length > 0) {
          html = $el.find('li a[data-option=\'' + val + '\']').html();
        } else if ($el.find('li a').length > 0) {
          html = $el.find('li a').eq(0).html();
        } else {
          val = '';
          html = '';
        }

        $el.find('input[type="hidden"]').val(val);
        $el.find('.bfh-selectbox-option').html(html);
      } else if (origHook) {
        return origHook.set(el,val);
      }
    }
  };


  /* SELECTBOX DATA-API
   * ============== */

  $(document).ready( function () {
    $('div.bfh-selectbox').each(function () {
      var $selectbox;

      $selectbox = $(this);

      $selectbox.bfhselectbox($selectbox.data());
    });
  });


  /* APPLY TO STANDARD SELECTBOX ELEMENTS
   * =================================== */

  $(document)
    .on('click.bfhselectbox.data-api', clearMenus);

}(window.jQuery);

/* ==========================================================
 * bootstrap-formhelpers-slider.js
 * https://github.com/vlamanna/BootstrapFormHelpers
 * ==========================================================
 * Copyright 2012 Vincent Lamanna
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */

+function ($) {

  'use strict';


  /* BFHSLIDER CLASS DEFINITION
   * ========================= */

  var BFHSlider = function (element, options) {
        this.options = $.extend({}, $.fn.bfhslider.defaults, options);
        this.$element = $(element);
        
        this.initSlider();
      };

  BFHSlider.prototype = {

    constructor: BFHSlider,

    initSlider: function() {
      if (this.options.value === '') {
        this.options.value = this.options.min;
      }
      
      this.$element.html(
        '<input type="hidden" name="' + this.options.name + '" value="">' +
        '<div class="bfh-slider-handle"><div class="bfh-slider-value"></div></div>'
      );
      
      this.$element.find('input[type="hidden"]').val(this.options.value);
      this.updateHandle(this.options.value);
      
      this.$element.on('mousedown.bfhslider.data-api', BFHSlider.prototype.mouseDown);
    },
    
    updateHandle: function(val) {
      var positionX,
          width,
          left,
          span;
          
      span = this.options.max - this.options.min;
      width = this.$element.width();
      left = this.$element.position().left;
      
      positionX = Math.round((val - this.options.min) * (width - 20) / span + left);
      
      this.$element.find('.bfh-slider-handle').css('left', positionX + 'px');
      this.$element.find('.bfh-slider-value').text(val);
    },
    
    updateVal: function(positionX) {
      var width,
          left,
          right,
          val,
          span;
      
      span = this.options.max - this.options.min;
      width = this.$element.width();
      left = this.$element.offset().left;
      right = left + width;
      
      if (positionX < left) {
        positionX = left;
      }
      
      if (positionX + 20 > right) {
        positionX = right;
      }
      
      val = (positionX - left) / width;
      val = Math.ceil(val * span + this.options.min);
      
      if (val === this.$element.val()) {
        return true;
      }
      
      this.$element.val(val);
      
      this.$element.trigger('change.bfhslider');
    },
    
    mouseDown: function() {
      var $this;
      
      $this = $(this);
      
      if ($this.is('.disabled') || $this.attr('disabled') !== undefined) {
        return true;
      }
      
      $(document)
        .on('mousemove.bfhslider.data-api', {slider: $this}, BFHSlider.prototype.mouseMove)
        .one('mouseup.bfhslider.data-api', {slider: $this}, BFHSlider.prototype.mouseUp);
    },
    
    mouseMove: function(e) {
      var $this;
      
      $this = e.data.slider;
      
      $this.data('bfhslider').updateVal(e.pageX);
    },
    
    mouseUp: function(e) {
      var $this;
      
      $this = e.data.slider;
      
      $this.data('bfhslider').updateVal(e.pageX);
      
      $(document).off('mousemove.bfhslider.data-api');
    }
  };


  /* SLIDER PLUGIN DEFINITION
   * ========================== */

  var old = $.fn.bfhslider;

  $.fn.bfhslider = function (option) {
    return this.each(function () {
      var $this,
          data,
          options;

      $this = $(this);
      data = $this.data('bfhslider');
      options = typeof option === 'object' && option;
      this.type = 'bfhslider';

      if (!data) {
        $this.data('bfhslider', (data = new BFHSlider(this, options)));
      }
      if (typeof option === 'string') {
        data[option].call($this);
      }
    });
  };

  $.fn.bfhslider.Constructor = BFHSlider;

  $.fn.bfhslider.defaults = {
    name: '',
    value: '',
    min: 0,
    max: 100
  };


  /* SLIDER NO CONFLICT
   * ========================== */

  $.fn.bfhslider.noConflict = function () {
    $.fn.bfhslider = old;
    return this;
  };


  /* SLIDER VALHOOKS
   * ========================== */

  var origHook;
  if ($.valHooks.div){
    origHook = $.valHooks.div;
  }
  $.valHooks.div = {
    get: function(el) {
      if ($(el).hasClass('bfh-slider')) {
        return $(el).find('input[type="hidden"]').val();
      } else if (origHook) {
        return origHook.get(el);
      }
    },
    set: function(el, val) {
      if ($(el).hasClass('bfh-slider')) {
        $(el).find('input[type="hidden"]').val(val);
        $(el).data('bfhslider').updateHandle(val);
      } else if (origHook) {
        return origHook.set(el,val);
      }
    }
  };


  /* SLIDER DATA-API
   * ============== */

  $(document).ready( function () {
    $('div.bfh-slider').each(function () {
      var $slider;

      $slider = $(this);

      $slider.bfhslider($slider.data());
    });
  });

}(window.jQuery);

/* ==========================================================
 * bootstrap-formhelpers-states.js
 * https://github.com/vlamanna/BootstrapFormHelpers
 * ==========================================================
 * Copyright 2012 Vincent Lamanna
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */

+function ($) {

  'use strict';


  /* STATES CLASS DEFINITION
   * ====================== */

  var BFHStates = function (element, options) {
    this.options = $.extend({}, $.fn.bfhstates.defaults, options);
    this.$element = $(element);

    if (this.$element.is('select')) {
      this.addStates();
    }

    if (this.$element.hasClass('bfh-selectbox')) {
      this.addBootstrapStates();
    }

    if (this.$element.is('span')) {
      this.displayState();
    }
  };

  BFHStates.prototype = {

    constructor: BFHStates,

    addStates: function () {
      var country,
          $country;

      country = this.options.country;

      if (country !== '') {
        $country = $(document).find('#' + country);

        if ($country.length !== 0) {
          country = $country.val();
          $country.on('change', {state: this}, this.changeCountry);
        }
      }

      this.loadStates(country);
    },

    loadStates: function (country) {
      var value,
          state;

      value = this.options.state;

      this.$element.html('');

      if (this.options.blank === true) {
        this.$element.append('<option value=""></option>');
      }

      for (state in BFHStatesList[country]) {
        if (BFHStatesList[country].hasOwnProperty(state)) {
          this.$element.append('<option value="' + BFHStatesList[country][state].code + '">' + BFHStatesList[country][state].name + '</option>');
        }
      }

      this.$element.val(value);
    },

    changeCountry: function (e) {
      var $this,
          $state,
          country;

      $this = $(this);
      $state = e.data.state;
      country = $this.val();

      $state.loadStates(country);
    },

    addBootstrapStates: function() {
      var country,
          $country;

      country = this.options.country;

      if (country !== '') {
        $country = $(document).find('#' + country);

        if ($country.length !== 0) {
          country = $country.find('input[type="hidden"]').val();
          $country.on('change.bfhselectbox', {state: this}, this.changeBootstrapCountry);
        }
      }

      this.loadBootstrapStates(country);
    },

    loadBootstrapStates: function(country) {
      var $input,
          $toggle,
          $options,
          stateCode,
          stateName,
          state;

      stateCode = this.options.state;
      stateName = '';
      $input = this.$element.find('input[type="hidden"]');
      $toggle = this.$element.find('.bfh-selectbox-option');
      $options = this.$element.find('[role=option]');

      $options.html('');

      if (this.options.blank === true) {
        $options.append('<li><a tabindex="-1" href="#" data-option=""></a></li>');
      }

      for (state in BFHStatesList[country]) {
        if (BFHStatesList[country].hasOwnProperty(state)) {
          $options.append('<li><a tabindex="-1" href="#" data-option="' + BFHStatesList[country][state].code + '">' + BFHStatesList[country][state].name + '</a></li>');

          if (BFHStatesList[country][state].code === stateCode) {
            stateName = BFHStatesList[country][state].name;
          }
        }
      }

      this.$element.val(stateCode);
    },

    changeBootstrapCountry: function (e) {
      var $this,
          $state,
          country;

      $this = $(this);
      $state = e.data.state;
      country = $this.val();

      $state.loadBootstrapStates(country);
    },

    displayState: function () {
      var country,
          stateCode,
          stateName,
          state;

      country = this.options.country;
      stateCode = this.options.state;
      stateName = '';

      for (state in BFHStatesList[country]) {
        if (BFHStatesList[country].hasOwnProperty(state)) {
          if (BFHStatesList[country][state].code === stateCode) {
            stateName = BFHStatesList[country][state].name;
            break;
          }
        }
      }
      this.$element.html(stateName);
    }

  };


  /* STATES PLUGIN DEFINITION
   * ======================= */

  var old = $.fn.bfhstates;

  $.fn.bfhstates = function (option) {
    return this.each(function () {
      var $this,
          data,
          options;

      $this = $(this);
      data = $this.data('bfhstates');
      options = typeof option === 'object' && option;

      if (!data) {
        $this.data('bfhstates', (data = new BFHStates(this, options)));
      }
      if (typeof option === 'string') {
        data[option].call($this);
      }
    });
  };

  $.fn.bfhstates.Constructor = BFHStates;

  $.fn.bfhstates.defaults = {
    country: '',
    state: '',
    blank: true
  };


  /* STATES NO CONFLICT
   * ========================== */

  $.fn.bfhstates.noConflict = function () {
    $.fn.bfhstates = old;
    return this;
  };


  /* STATES DATA-API
   * ============== */

  $(document).ready( function () {
    $('form select.bfh-states, span.bfh-states, div.bfh-states').each(function () {
      var $states;

      $states = $(this);

      if ($states.hasClass('bfh-selectbox')) {
        $states.bfhselectbox($states.data());
      }
      $states.bfhstates($states.data());
    });
  });

}(window.jQuery);

/* ==========================================================
 * bootstrap-formhelpers-timepicker.js
 * https://github.com/vlamanna/BootstrapFormHelpers
 * ==========================================================
 * Copyright 2012 Vincent Lamanna
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */


+function ($) {

  'use strict';


 /* TIMEPICKER CLASS DEFINITION
  * ========================= */

  var toggle = '[data-toggle=bfh-timepicker]',
      BFHTimePicker = function (element, options) {
        this.options = $.extend({}, $.fn.bfhtimepicker.defaults, options);
        this.$element = $(element);

        this.initPopover();
      };

  BFHTimePicker.prototype = {

    constructor: BFHTimePicker,

    setTime: function() {
      var time,
          today,
          timeParts,
          hours,
          minutes,
          mode,
          currentMode;

      time = this.options.time;
      mode = '';
      currentMode = '';
      
      if (time === '' || time === 'now' || time === undefined) {
        today = new Date();

        hours = today.getHours();
        minutes = today.getMinutes();
        
        if (this.options.mode === '12h') {
          if (hours > 12) {
            hours = hours - 12;
            mode = ' ' + BFHTimePickerModes.pm;
            currentMode = 'pm';
          } else {
            mode = ' ' + BFHTimePickerModes.am;
            currentMode = 'am';
          }
        }
        
        if (time === 'now') {
          this.$element.find('.bfh-timepicker-toggle > input[type="text"]').val(formatTime(hours, minutes) + mode);
        }

        this.$element.data('hour', hours);
        this.$element.data('minute', minutes);
        this.$element.data('mode', currentMode);
      } else {
        timeParts = String(time).split(BFHTimePickerDelimiter);
        hours = timeParts[0];
        minutes = timeParts[1];
        
        if (this.options.mode === '12h') {
          timeParts = String(minutes).split(' ');
          minutes = timeParts[0];
          if (timeParts[1] === BFHTimePickerModes.pm) {
            currentMode = 'pm';
          } else {
            currentMode = 'am';
          }
        }
        
        this.$element.find('.bfh-timepicker-toggle > input[type="text"]').val(time);
        this.$element.data('hour', hours);
        this.$element.data('minute', minutes);
        this.$element.data('mode', currentMode);
      }
    },

    initPopover: function() {
      var iconLeft,
          iconRight,
          iconAddon,
          modeAddon,
          modeMax;

      iconLeft = '';
      iconRight = '';
      iconAddon = '';
      if (this.options.icon !== '') {
        if (this.options.align === 'right') {
          iconRight = '<span class="input-group-addon"><i class="' + this.options.icon + '"></i></span>';
        } else {
          iconLeft = '<span class="input-group-addon"><i class="' + this.options.icon + '"></i></span>';
        }
        iconAddon = 'input-group';
      }
      
      modeAddon = '';
      modeMax = '23';
      if (this.options.mode === '12h') {
        modeAddon = '<td>' +
          '<div class="bfh-selectbox" data-input="' + this.options.input + '" data-value="am">' +
          '<div data-value="am">' + BFHTimePickerModes.am + '</div>' +
          '<div data-value="pm">' + BFHTimePickerModes.pm + '</div>' +
          '</div>';
        modeMax = '11';
      }

      this.$element.html(
        '<div class="' + iconAddon + ' bfh-timepicker-toggle" data-toggle="bfh-timepicker">' +
        iconLeft +
        '<input type="text" name="' + this.options.name + '" class="' + this.options.input + '" placeholder="' + this.options.placeholder + '" readonly>' +
        iconRight +
        '</div>' +
        '<div class="bfh-timepicker-popover">' +
        '<table class="table">' +
        '<tbody>' +
        '<tr>' +
        '<td class="hour">' +
        '<input type="text" class="' + this.options.input + ' bfh-number"  data-min="0" data-max="' + modeMax + '" data-zeros="true" data-wrap="true">' +
        '</td>' +
        '<td class="separator">' + BFHTimePickerDelimiter + '</td>' +
        '<td class="minute">' +
        '<input type="text" class="' + this.options.input + ' bfh-number"  data-min="0" data-max="59" data-zeros="true" data-wrap="true">' +
        '</td>' +
        modeAddon +
        '</tr>' +
        '</tbody>' +
        '</table>' +
        '</div>'
      );

      this.$element
        .on('click.bfhtimepicker.data-api touchstart.bfhtimepicker.data-api', toggle, BFHTimePicker.prototype.toggle)
        .on('click.bfhtimepicker.data-api touchstart.bfhtimepicker.data-api', '.bfh-timepicker-popover > table', function() { return false; });

      this.$element.find('.bfh-number').each(function () {
        var $number;

        $number = $(this);

        $number.bfhnumber($number.data());
        
        $number.on('change', BFHTimePicker.prototype.change);
      });
      
      this.$element.find('.bfh-selectbox').each(function() {
        var $selectbox;

        $selectbox = $(this);

        $selectbox.bfhselectbox($selectbox.data());
        
        $selectbox.on('change.bfhselectbox', BFHTimePicker.prototype.change);
      });
      
      this.setTime();

      this.updatePopover();
    },

    updatePopover: function() {
      var hour,
          minute,
          mode;

      hour = this.$element.data('hour');
      minute = this.$element.data('minute');
      mode = this.$element.data('mode');

      this.$element.find('.hour input[type=text]').val(hour).change();
      this.$element.find('.minute input[type=text]').val(minute).change();
      this.$element.find('.bfh-selectbox').val(mode);
    },
    
    change: function() {
      var $this,
          $parent,
          $timePicker,
          mode;

      $this = $(this);
      $parent = getParent($this);
      
      $timePicker = $parent.data('bfhtimepicker');
      
      if ($timePicker && $timePicker !== 'undefined') {
        mode = '';
        if ($timePicker.options.mode === '12h') {
          mode = ' ' + BFHTimePickerModes[$parent.find('.bfh-selectbox').val()];
        }
        
        $parent.find('.bfh-timepicker-toggle > input[type="text"]').val($parent.find('.hour input[type=text]').val() + BFHTimePickerDelimiter + $parent.find('.minute input[type=text]').val() + mode);

        $parent.trigger('change.bfhtimepicker');
      }

      return false;
    },

    toggle: function(e) {
      var $this,
          $parent,
          isActive;

      $this = $(this);
      $parent = getParent($this);

      if ($parent.is('.disabled') || $parent.attr('disabled') !== undefined) {
        return true;
      }

      isActive = $parent.hasClass('open');

      clearMenus();

      if (!isActive) {
        $parent.trigger(e = $.Event('show.bfhtimepicker'));

        if (e.isDefaultPrevented()) {
          return true;
        }

        $parent
          .toggleClass('open')
          .trigger('shown.bfhtimepicker');

        $this.focus();
      }

      return false;
    }
  };

  function formatTime(hour, minute) {
    hour = String(hour);
    if (hour.length === 1) {
      hour = '0' + hour;
    }

    minute = String(minute);
    if (minute.length === 1) {
      minute = '0' + minute;
    }

    return hour + BFHTimePickerDelimiter + minute;
  }
  
  function clearMenus() {
    var $parent;

    $(toggle).each(function (e) {
      $parent = getParent($(this));

      if (!$parent.hasClass('open')) {
        return true;
      }

      $parent.trigger(e = $.Event('hide.bfhtimepicker'));

      if (e.isDefaultPrevented()) {
        return true;
      }

      $parent
        .removeClass('open')
        .trigger('hidden.bfhtimepicker');
    });
  }

  function getParent($this) {
    return $this.closest('.bfh-timepicker');
  }


  /* TIMEPICKER PLUGIN DEFINITION
   * ========================== */

  var old = $.fn.bfhtimepicker;

  $.fn.bfhtimepicker = function (option) {
    return this.each(function () {
      var $this,
          data,
          options;

      $this = $(this);
      data = $this.data('bfhtimepicker');
      options = typeof option === 'object' && option;
      this.type = 'bfhtimepicker';

      if (!data) {
        $this.data('bfhtimepicker', (data = new BFHTimePicker(this, options)));
      }
      if (typeof option === 'string') {
        data[option].call($this);
      }
    });
  };

  $.fn.bfhtimepicker.Constructor = BFHTimePicker;

  $.fn.bfhtimepicker.defaults = {
    icon: 'glyphicon glyphicon-time',
    align: 'left',
    input: 'form-control',
    placeholder: '',
    name: '',
    time: 'now',
    mode: '24h'
  };


  /* TIMEPICKER NO CONFLICT
   * ========================== */

  $.fn.bfhtimepicker.noConflict = function () {
    $.fn.bfhtimepicker = old;
    return this;
  };


  /* TIMEPICKER VALHOOKS
   * ========================== */

  var origHook;
  if ($.valHooks.div){
    origHook = $.valHooks.div;
  }
  $.valHooks.div = {
    get: function(el) {
      if ($(el).hasClass('bfh-timepicker')) {
        return $(el).find('.bfh-timepicker-toggle > input[type="text"]').val();
      } else if (origHook) {
        return origHook.get(el);
      }
    },
    set: function(el, val) {
      var $timepicker;
      if ($(el).hasClass('bfh-timepicker')) {
        $timepicker = $(el).data('bfhtimepicker');
        $timepicker.options.time = val;
        $timepicker.setTime();
        $timepicker.updatePopover();
      } else if (origHook) {
        return origHook.set(el,val);
      }
    }
  };


  /* TIMEPICKER DATA-API
   * ============== */

  $(document).ready( function () {
    $('div.bfh-timepicker').each(function () {
      var $timepicker;

      $timepicker = $(this);

      $timepicker.bfhtimepicker($timepicker.data());
    });
  });


  /* APPLY TO STANDARD TIMEPICKER ELEMENTS
   * =================================== */

  $(document)
    .on('click.bfhtimepicker.data-api', clearMenus);

}(window.jQuery);

/* ==========================================================
 * bootstrap-formhelpers-timezones.js
 * https://github.com/vlamanna/BootstrapFormHelpers
 * ==========================================================
 * Copyright 2012 Vincent Lamanna
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */

+function ($) {

  'use strict';


  /* TIMEZONES CLASS DEFINITION
   * ====================== */

  var BFHTimezones = function (element, options) {
    this.options = $.extend({}, $.fn.bfhtimezones.defaults, options);
    this.$element = $(element);

    if (this.$element.is('select')) {
      this.addTimezones();
    }

    if (this.$element.hasClass('bfh-selectbox')) {
      this.addBootstrapTimezones();
    }
  };

  BFHTimezones.prototype = {

    constructor: BFHTimezones,

    addTimezones: function () {
      var country,
          $country;

      country = this.options.country;

      if (country !== '') {
        $country = $(document).find('#' + country);

        if ($country.length !== 0) {
          country = $country.val();
          $country.on('change', {timezone: this}, this.changeCountry);
        }
      }

      this.loadTimezones(country);
    },

    loadTimezones: function (country) {
      var value,
          timezone;

      value = this.options.timezone;

      this.$element.html('');

      if (this.options.blank === true) {
        this.$element.append('<option value=""></option>');
      }

      for (timezone in BFHTimezonesList[country]) {
        if (BFHTimezonesList[country].hasOwnProperty(timezone)) {
          this.$element.append('<option value="' + timezone + '">' + BFHTimezonesList[country][timezone] + '</option>');
        }
      }

      this.$element.val(value);
    },

    changeCountry: function (e) {
      var $this,
          $timezone,
          country;

      $this = $(this);
      $timezone = e.data.timezone;
      country = $this.val();

      $timezone.loadTimezones(country);
    },

    addBootstrapTimezones: function() {
      var country,
          $country;

      country = this.options.country;

      if (country !== '') {
        $country = $(document).find('#' + country);

        if ($country.length !== 0) {
          country = $country.find('input[type="hidden"]').val();
          $country.on('change.bfhselectbox', {timezone: this}, this.changeBootstrapCountry);
        }
      }

      this.loadBootstrapTimezones(country);
    },

    loadBootstrapTimezones: function(country) {
      var $input,
          $toggle,
          $options,
          value,
          timezone;

      value = this.options.timezone;
      $input = this.$element.find('input[type="hidden"]');
      $toggle = this.$element.find('.bfh-selectbox-option');
      $options = this.$element.find('[role=option]');

      $options.html('');

      if (this.options.blank === true) {
        $options.append('<li><a tabindex="-1" href="#" data-option=""></a></li>');
      }

      for (timezone in BFHTimezonesList[country]) {
        if (BFHTimezonesList[country].hasOwnProperty(timezone)) {
          $options.append('<li><a tabindex="-1" href="#" data-option="' + timezone + '">' + BFHTimezonesList[country][timezone] + '</a></li>');
        }
      }

      this.$element.val(value);
    },

    changeBootstrapCountry: function (e) {
      var $this,
          $timezone,
          country;

      $this = $(this);
      $timezone = e.data.timezone;
      country = $this.val();

      $timezone.loadBootstrapTimezones(country);
    }

  };


  /* TIMEZONES PLUGIN DEFINITION
   * ======================= */

  var old = $.fn.bfhtimezones;

  $.fn.bfhtimezones = function (option) {
    return this.each(function () {
      var $this,
          data,
          options;

      $this = $(this);
      data = $this.data('bfhtimezones');
      options = typeof option === 'object' && option;

      if (!data) {
        $this.data('bfhtimezones', (data = new BFHTimezones(this, options)));
      }
      if (typeof option === 'string') {
        data[option].call($this);
      }
    });
  };

  $.fn.bfhtimezones.Constructor = BFHTimezones;

  $.fn.bfhtimezones.defaults = {
    country: '',
    timezone: '',
    blank: true
  };


  /* TIMEZONES NO CONFLICT
   * ========================== */

  $.fn.bfhtimezones.noConflict = function () {
    $.fn.bfhtimezones = old;
    return this;
  };


  /* TIMEZONES DATA-API
   * ============== */

  $(document).ready( function () {
    $('form select.bfh-timezones, div.bfh-timezones').each(function () {
      var $timezones;

      $timezones = $(this);

      if ($timezones.hasClass('bfh-selectbox')) {
        $timezones.bfhselectbox($timezones.data());
      }
      $timezones.bfhtimezones($timezones.data());
    });
  });

}(window.jQuery);

!function(a){function b(b,d){if(g[b]){var e=c(this),f=g[b].apply(e,d);return"undefined"==typeof f?a(this):f}throw new Error("method '"+b+"()' does not exist for slider.")}function c(b){var c=a(b).data("slider");if(c&&c instanceof f)return c;throw new Error(e.callingContextNotSliderInstance)}function d(b){var c=a(this);return c.each(function(){var c=a(this),d=c.data("slider"),e="object"==typeof b&&b;d&&!e&&(e={},a.each(a.fn.slider.defaults,function(a){e[a]=d[a]})),c.data("slider",new f(this,a.extend({},a.fn.slider.defaults,e)))}),c}var e={formatInvalidInputErrorMsg:function(a){return"Invalid input value '"+a+"' passed in"},callingContextNotSliderInstance:"Calling context element does not have instance of Slider bound to it. Check your code to make sure the JQuery object returned from the call to the slider() initializer is calling the method"},f=function(b,c){var d=this.element=a(b).hide(),e=a(b)[0].style.width,f=!1,g=this.element.parent();g.hasClass("slider")===!0?(f=!0,this.picker=g):this.picker=a('<div class="slider"><div class="slider-track"><div class="slider-selection"></div><div class="slider-handle"></div><div class="slider-handle"></div></div><div id="tooltip" class="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div><div id="tooltip_min" class="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div><div id="tooltip_max" class="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div></div>').insertBefore(this.element).append(this.element),this.id=this.element.data("slider-id")||c.id,this.id&&(this.picker[0].id=this.id),("ontouchstart"in window||window.DocumentTouch&&document instanceof window.DocumentTouch)&&(this.touchCapable=!0);var h=this.element.data("slider-tooltip")||c.tooltip;switch(this.tooltip=this.picker.find("#tooltip"),this.tooltipInner=this.tooltip.find("div.tooltip-inner"),this.tooltip_min=this.picker.find("#tooltip_min"),this.tooltipInner_min=this.tooltip_min.find("div.tooltip-inner"),this.tooltip_max=this.picker.find("#tooltip_max"),this.tooltipInner_max=this.tooltip_max.find("div.tooltip-inner"),f===!0&&(this.picker.removeClass("slider-horizontal"),this.picker.removeClass("slider-vertical"),this.tooltip.removeClass("hide"),this.tooltip_min.removeClass("hide"),this.tooltip_max.removeClass("hide")),this.orientation=this.element.data("slider-orientation")||c.orientation,this.orientation){case"vertical":this.picker.addClass("slider-vertical"),this.stylePos="top",this.mousePos="pageY",this.sizePos="offsetHeight",this.tooltip.addClass("right")[0].style.left="100%",this.tooltip_min.addClass("right")[0].style.left="100%",this.tooltip_max.addClass("right")[0].style.left="100%";break;default:this.picker.addClass("slider-horizontal").css("width",e),this.orientation="horizontal",this.stylePos="left",this.mousePos="pageX",this.sizePos="offsetWidth",this.tooltip.addClass("top")[0].style.top=-this.tooltip.outerHeight()-14+"px",this.tooltip_min.addClass("top")[0].style.top=-this.tooltip_min.outerHeight()-14+"px",this.tooltip_max.addClass("top")[0].style.top=-this.tooltip_max.outerHeight()-14+"px"}var i=this;a.each(["min","max","step","value"],function(a,b){i[b]="undefined"!=typeof d.data("slider-"+b)?d.data("slider-"+b):"undefined"!=typeof c[b]?c[b]:"undefined"!=typeof d.prop(b)?d.prop(b):0}),this.value instanceof Array?f&&!this.range?this.value=this.value[0]:this.range=!0:this.range&&(this.value=[this.value,this.max]),this.selection=this.element.data("slider-selection")||c.selection,this.selectionEl=this.picker.find(".slider-selection"),"none"===this.selection&&this.selectionEl.addClass("hide"),this.selectionElStyle=this.selectionEl[0].style,this.handle1=this.picker.find(".slider-handle:first"),this.handle1Stype=this.handle1[0].style,this.handle2=this.picker.find(".slider-handle:last"),this.handle2Stype=this.handle2[0].style,f===!0&&(this.handle1.removeClass("round triangle"),this.handle2.removeClass("round triangle hide"));var j=this.element.data("slider-handle")||c.handle;switch(j){case"round":this.handle1.addClass("round"),this.handle2.addClass("round");break;case"triangle":this.handle1.addClass("triangle"),this.handle2.addClass("triangle")}this.range?(this.value[0]=Math.max(this.min,Math.min(this.max,this.value[0])),this.value[1]=Math.max(this.min,Math.min(this.max,this.value[1]))):(this.value=[Math.max(this.min,Math.min(this.max,this.value))],this.handle2.addClass("hide"),this.value[1]="after"===this.selection?this.max:this.min),this.diff=this.max-this.min,this.percentage=this.diff>0?[100*(this.value[0]-this.min)/this.diff,100*(this.value[1]-this.min)/this.diff,100*this.step/this.diff]:[0,0,100],this.offset=this.picker.offset(),this.size=this.picker[0][this.sizePos],this.formater=c.formater,this.tooltip_separator=c.tooltip_separator,this.tooltip_split=c.tooltip_split,this.reversed=this.element.data("slider-reversed")||c.reversed,this.layout(),this.layout(),this.handle1.on({keydown:a.proxy(this.keydown,this,0)}),this.handle2.on({keydown:a.proxy(this.keydown,this,1)}),this.touchCapable&&this.picker.on({touchstart:a.proxy(this.mousedown,this)}),this.picker.on({mousedown:a.proxy(this.mousedown,this)}),"hide"===h?(this.tooltip.addClass("hide"),this.tooltip_min.addClass("hide"),this.tooltip_max.addClass("hide")):"always"===h?(this.showTooltip(),this.alwaysShowTooltip=!0):(this.picker.on({mouseenter:a.proxy(this.showTooltip,this),mouseleave:a.proxy(this.hideTooltip,this)}),this.handle1.on({focus:a.proxy(this.showTooltip,this),blur:a.proxy(this.hideTooltip,this)}),this.handle2.on({focus:a.proxy(this.showTooltip,this),blur:a.proxy(this.hideTooltip,this)})),this.enabled=c.enabled&&(void 0===this.element.data("slider-enabled")||this.element.data("slider-enabled")===!0),this.enabled?this.enable():this.disable()};f.prototype={constructor:f,over:!1,inDrag:!1,showTooltip:function(){this.tooltip_split===!1?this.tooltip.addClass("in"):(this.tooltip_min.addClass("in"),this.tooltip_max.addClass("in")),this.over=!0},hideTooltip:function(){this.inDrag===!1&&this.alwaysShowTooltip!==!0&&(this.tooltip.removeClass("in"),this.tooltip_min.removeClass("in"),this.tooltip_max.removeClass("in")),this.over=!1},layout:function(){var a;if(a=this.reversed?[100-this.percentage[0],this.percentage[1]]:[this.percentage[0],this.percentage[1]],this.handle1Stype[this.stylePos]=a[0]+"%",this.handle2Stype[this.stylePos]=a[1]+"%","vertical"===this.orientation)this.selectionElStyle.top=Math.min(a[0],a[1])+"%",this.selectionElStyle.height=Math.abs(a[0]-a[1])+"%";else{this.selectionElStyle.left=Math.min(a[0],a[1])+"%",this.selectionElStyle.width=Math.abs(a[0]-a[1])+"%";var b=this.tooltip_min[0].getBoundingClientRect(),c=this.tooltip_max[0].getBoundingClientRect();b.right>c.left?(this.tooltip_max.removeClass("top"),this.tooltip_max.addClass("bottom")[0].style.top="18px"):(this.tooltip_max.removeClass("bottom"),this.tooltip_max.addClass("top")[0].style.top="-30px")}this.range?(this.tooltipInner.text(this.formater(this.value[0])+this.tooltip_separator+this.formater(this.value[1])),this.tooltip[0].style[this.stylePos]=this.size*(a[0]+(a[1]-a[0])/2)/100-("vertical"===this.orientation?this.tooltip.outerHeight()/2:this.tooltip.outerWidth()/2)+"px",this.tooltipInner_min.text(this.formater(this.value[0])),this.tooltipInner_max.text(this.formater(this.value[1])),this.tooltip_min[0].style[this.stylePos]=this.size*(a[0]/100)-("vertical"===this.orientation?this.tooltip_min.outerHeight()/2:this.tooltip_min.outerWidth()/2)+"px",this.tooltip_max[0].style[this.stylePos]=this.size*(a[1]/100)-("vertical"===this.orientation?this.tooltip_max.outerHeight()/2:this.tooltip_max.outerWidth()/2)+"px"):(this.tooltipInner.text(this.formater(this.value[0])),this.tooltip[0].style[this.stylePos]=this.size*a[0]/100-("vertical"===this.orientation?this.tooltip.outerHeight()/2:this.tooltip.outerWidth()/2)+"px")},mousedown:function(b){if(!this.isEnabled())return!1;this.touchCapable&&"touchstart"===b.type&&(b=b.originalEvent),this.triggerFocusOnHandle(),this.offset=this.picker.offset(),this.size=this.picker[0][this.sizePos];var c=this.getPercentage(b);if(this.range){var d=Math.abs(this.percentage[0]-c),e=Math.abs(this.percentage[1]-c);this.dragged=e>d?0:1}else this.dragged=0;this.percentage[this.dragged]=this.reversed?100-c:c,this.layout(),this.touchCapable&&a(document).on({touchmove:a.proxy(this.mousemove,this),touchend:a.proxy(this.mouseup,this)}),a(document).on({mousemove:a.proxy(this.mousemove,this),mouseup:a.proxy(this.mouseup,this)}),this.inDrag=!0;var f=this.calculateValue();return this.setValue(f),this.element.trigger({type:"slideStart",value:f}).data("value",f).prop("value",f),!0},triggerFocusOnHandle:function(a){0===a&&this.handle1.focus(),1===a&&this.handle2.focus()},keydown:function(a,b){if(!this.isEnabled())return!1;var c;switch(b.which){case 37:case 40:c=-1;break;case 39:case 38:c=1}if(c){var d=c*this.percentage[2],e=this.percentage[a]+d;e>100?e=100:0>e&&(e=0),this.dragged=a,this.adjustPercentageForRangeSliders(e),this.percentage[this.dragged]=e,this.layout();var f=this.calculateValue();return this.setValue(f),this.element.trigger({type:"slideStop",value:f}).data("value",f).prop("value",f),!1}},mousemove:function(a){if(!this.isEnabled())return!1;this.touchCapable&&"touchmove"===a.type&&(a=a.originalEvent);var b=this.getPercentage(a);this.adjustPercentageForRangeSliders(b),this.percentage[this.dragged]=this.reversed?100-b:b,this.layout();var c=this.calculateValue();return this.setValue(c),!1},adjustPercentageForRangeSliders:function(a){this.range&&(0===this.dragged&&this.percentage[1]<a?(this.percentage[0]=this.percentage[1],this.dragged=1):1===this.dragged&&this.percentage[0]>a&&(this.percentage[1]=this.percentage[0],this.dragged=0))},mouseup:function(){if(!this.isEnabled())return!1;this.touchCapable&&a(document).off({touchmove:this.mousemove,touchend:this.mouseup}),a(document).off({mousemove:this.mousemove,mouseup:this.mouseup}),this.inDrag=!1,this.over===!1&&this.hideTooltip();var b=this.calculateValue();return this.layout(),this.element.data("value",b).prop("value",b).trigger({type:"slideStop",value:b}),!1},calculateValue:function(){var a;return this.range?(a=[this.min,this.max],0!==this.percentage[0]&&(a[0]=Math.max(this.min,this.min+Math.round(this.diff*this.percentage[0]/100/this.step)*this.step)),100!==this.percentage[1]&&(a[1]=Math.min(this.max,this.min+Math.round(this.diff*this.percentage[1]/100/this.step)*this.step)),this.value=a):(a=this.min+Math.round(this.diff*this.percentage[0]/100/this.step)*this.step,a<this.min?a=this.min:a>this.max&&(a=this.max),a=parseFloat(a),this.value=[a,this.value[1]]),a},getPercentage:function(a){!this.touchCapable||"touchstart"!==a.type&&"touchmove"!==a.type||(a=a.touches[0]);var b=100*(a[this.mousePos]-this.offset[this.stylePos])/this.size;return b=Math.round(b/this.percentage[2])*this.percentage[2],Math.max(0,Math.min(100,b))},getValue:function(){return this.range?this.value:this.value[0]},setValue:function(a){a||(a=0),this.value=this.validateInputValue(a),this.range?(this.value[0]=Math.max(this.min,Math.min(this.max,this.value[0])),this.value[1]=Math.max(this.min,Math.min(this.max,this.value[1]))):(this.value=[Math.max(this.min,Math.min(this.max,this.value))],this.handle2.addClass("hide"),this.value[1]="after"===this.selection?this.max:this.min),this.diff=this.max-this.min,this.percentage=this.diff>0?[100*(this.value[0]-this.min)/this.diff,100*(this.value[1]-this.min)/this.diff,100*this.step/this.diff]:[0,0,100],this.layout();var b=this.range?this.value:this.value[0];this.element.trigger({type:"slide",value:b}).data("value",this.value).prop("value",this.value)},validateInputValue:function(b){if("number"==typeof b)return b;if(b instanceof Array)return a.each(b,function(a,b){if("number"!=typeof b)throw new Error(e.formatInvalidInputErrorMsg(b))}),b;throw new Error(e.formatInvalidInputErrorMsg(b))},destroy:function(){this.handle1.off(),this.handle2.off(),this.element.off().show().insertBefore(this.picker),this.picker.off().remove(),a(this.element).removeData("slider")},disable:function(){this.enabled=!1,this.handle1.removeAttr("tabindex"),this.handle2.removeAttr("tabindex"),this.picker.addClass("slider-disabled"),this.element.trigger("slideDisabled")},enable:function(){this.enabled=!0,this.handle1.attr("tabindex",0),this.handle2.attr("tabindex",0),this.picker.removeClass("slider-disabled"),this.element.trigger("slideEnabled")},toggle:function(){this.enabled?this.disable():this.enable()},isEnabled:function(){return this.enabled},setAttribute:function(a,b){this[a]=b},getAttribute:function(a){return this[a]}};var g={getValue:f.prototype.getValue,setValue:f.prototype.setValue,setAttribute:f.prototype.setAttribute,getAttribute:f.prototype.getAttribute,destroy:f.prototype.destroy,disable:f.prototype.disable,enable:f.prototype.enable,toggle:f.prototype.toggle,isEnabled:f.prototype.isEnabled};a.fn.slider=function(a){if("string"==typeof a&&"refresh"!==a){var c=Array.prototype.slice.call(arguments,1);return b.call(this,a,c)}return d.call(this,a)},a.fn.slider.defaults={min:0,max:10,step:1,orientation:"horizontal",value:5,range:!1,selection:"before",tooltip:"show",tooltip_separator:":",tooltip_split:!1,handle:"round",reversed:!1,enabled:!0,formater:function(a){return a}},a.fn.slider.Constructor=f}(window.jQuery);
angular.module('ui.bootstrap-slider', [])
	.directive('slider', ['$parse', '$timeout', function ($parse, $timeout) {
		return {
			restrict: 'AE',
			replace: true,
			template: '<input type="text" />',
			require: 'ngModel',
			link: function ($scope, element, attrs, ngModelCtrl) {
				$.fn.slider.Constructor.prototype.disable = function () {
					this.picker.off();
				};

				$.fn.slider.Constructor.prototype.enable = function () {
					this.picker.on();
				};

                                if (attrs.ngChange) {
                                        ngModelCtrl.$viewChangeListeners.push(function() {
                                                    $scope.$apply(attrs.ngChange);
                                        });
                                }

                                var options = {};
				if(attrs.sliderid) options.id = attrs.sliderid;
				if(attrs.min) options.min = parseFloat(attrs.min);
				if(attrs.max) options.max = parseFloat(attrs.max);
				if(attrs.step) options.step = parseFloat(attrs.step);
				if(attrs.precision) options.precision = parseFloat(attrs.precision);
				if(attrs.orientation) options.orientation = attrs.orientation;
				if(attrs.value) {
					if (angular.isNumber(attrs.value) || angular.isArray(attrs.value)) {
						options.value = attrs.value;
					} else if (angular.isString(attrs.value)) {
						if (attrs.value.indexOf("[") === 0) {
							options.value = angular.fromJson(attrs.value);
						} else {
							options.value = parseFloat(attrs.value);
						}
					}

				}
				if(attrs.range) options.range = attrs.range === 'true';
				if(attrs.selection) options.selection = attrs.selection;
				if(attrs.tooltip) options.tooltip = attrs.tooltip;
				if(attrs.tooltipseparator) options.tooltip_separator = attrs.tooltipseparator;
				if(attrs.tooltipsplit) options.tooltip_split = attrs.tooltipsplit === 'true';
				if(attrs.handle) options.handle = attrs.handle;
				if(attrs.reversed) options.reversed = attrs.reversed === 'true';
				if(attrs.enabled) options.enabled = attrs.enabled === 'true';
				if(attrs.naturalarrowkeys) options.natural_arrow_keys = attrs.naturalarrowkeys === 'true';
                if(attrs.formater) options.formater = $scope.$eval(attrs.formater);

				if (options.range && !options.value) {
					options.value = [0,0]; // This is needed, because of value defined at $.fn.slider.defaults - default value 5 prevents creating range slider
				}

				var slider = $(element[0]).slider(options);
				var updateEvent = attrs.updateevent || 'slide';

				slider.on(updateEvent, function(ev) {
					ngModelCtrl.$setViewValue(ev.value);
					$timeout(function() {
						$scope.$apply();
					});
				});

				$scope.$watch(attrs.ngModel, function(value) {
					if(value || value === 0) {
						slider.slider('setValue', value, false);
					}
				});

				if (angular.isDefined(attrs.ngDisabled)) {
					$scope.$watch(attrs.ngDisabled, function(value) {
						if (value) {
							slider.slider('disable');
						} else {
							slider.slider('enable');
						}
					});
				}
			}
		};
	}])
;

'use strict';

angular.module('colorpicker.module', [])
    .factory('Helper', function () {
      return {
        closestSlider: function (elem) {
          var matchesSelector = elem.matches || elem.webkitMatchesSelector || elem.mozMatchesSelector || elem.msMatchesSelector;
          if (matchesSelector.bind(elem)('I')) {
            return elem.parentNode;
          }
          return elem;
        },
        getOffset: function (elem, fixedPosition) {
          var
              x = 0,
              y = 0,
              scrollX = 0,
              scrollY = 0;
          while (elem && !isNaN(elem.offsetLeft) && !isNaN(elem.offsetTop)) {
            x += elem.offsetLeft;
            y += elem.offsetTop;
            if (!fixedPosition && elem.tagName === 'BODY') {
              scrollX += document.documentElement.scrollLeft || elem.scrollLeft;
              scrollY += document.documentElement.scrollTop || elem.scrollTop;
            } else {
              scrollX += elem.scrollLeft;
              scrollY += elem.scrollTop;
            }
            elem = elem.offsetParent;
          }
          return {
            top: y,
            left: x,
            scrollX: scrollX,
            scrollY: scrollY
          };
        },
        // a set of RE's that can match strings and generate color tuples. https://github.com/jquery/jquery-color/
        stringParsers: [
          {
            re: /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(\d+(?:\.\d+)?)\s*)?\)/,
            parse: function (execResult) {
              return [
                execResult[1],
                execResult[2],
                execResult[3],
                execResult[4]
              ];
            }
          },
          {
            re: /rgba?\(\s*(\d+(?:\.\d+)?)\%\s*,\s*(\d+(?:\.\d+)?)\%\s*,\s*(\d+(?:\.\d+)?)\%\s*(?:,\s*(\d+(?:\.\d+)?)\s*)?\)/,
            parse: function (execResult) {
              return [
                2.55 * execResult[1],
                2.55 * execResult[2],
                2.55 * execResult[3],
                execResult[4]
              ];
            }
          },
          {
            re: /#([a-fA-F0-9]{2})([a-fA-F0-9]{2})([a-fA-F0-9]{2})/,
            parse: function (execResult) {
              return [
                parseInt(execResult[1], 16),
                parseInt(execResult[2], 16),
                parseInt(execResult[3], 16)
              ];
            }
          },
          {
            re: /#([a-fA-F0-9])([a-fA-F0-9])([a-fA-F0-9])/,
            parse: function (execResult) {
              return [
                parseInt(execResult[1] + execResult[1], 16),
                parseInt(execResult[2] + execResult[2], 16),
                parseInt(execResult[3] + execResult[3], 16)
              ];
            }
          }
        ]
      };
    })
    .factory('Color', ['Helper', function (Helper) {
      return {
        value: {
          h: 1,
          s: 1,
          b: 1,
          a: 1
        },
        // translate a format from Color object to a string
        'rgb': function () {
          var rgb = this.toRGB();
          return 'rgb(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ')';
        },
        'rgba': function () {
          var rgb = this.toRGB();
          return 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + rgb.a + ')';
        },
        'hex': function () {
          return  this.toHex();
        },

        // HSBtoRGB from RaphaelJS
        RGBtoHSB: function (r, g, b, a) {
          r /= 255;
          g /= 255;
          b /= 255;

          var H, S, V, C;
          V = Math.max(r, g, b);
          C = V - Math.min(r, g, b);
          H = (C === 0 ? null :
              V === r ? (g - b) / C :
                  V === g ? (b - r) / C + 2 :
                      (r - g) / C + 4
              );
          H = ((H + 360) % 6) * 60 / 360;
          S = C === 0 ? 0 : C / V;
          return {h: H || 1, s: S, b: V, a: a || 1};
        },

        //parse a string to HSB
        setColor: function (val) {
          val = val.toLowerCase();
          for (var key in Helper.stringParsers) {
            if (Helper.stringParsers.hasOwnProperty(key)) {
              var parser = Helper.stringParsers[key];
              var match = parser.re.exec(val),
                  values = match && parser.parse(match);
              if (values) {
                this.value = this.RGBtoHSB.apply(null, values);
                return false;
              }
            }
          }
        },

        setHue: function (h) {
          this.value.h = 1 - h;
        },

        setSaturation: function (s) {
          this.value.s = s;
        },

        setLightness: function (b) {
          this.value.b = 1 - b;
        },

        setAlpha: function (a) {
          this.value.a = parseInt((1 - a) * 100, 10) / 100;
        },

        // HSBtoRGB from RaphaelJS
        // https://github.com/DmitryBaranovskiy/raphael/
        toRGB: function (h, s, b, a) {
          if (!h) {
            h = this.value.h;
            s = this.value.s;
            b = this.value.b;
          }
          h *= 360;
          var R, G, B, X, C;
          h = (h % 360) / 60;
          C = b * s;
          X = C * (1 - Math.abs(h % 2 - 1));
          R = G = B = b - C;

          h = ~~h;
          R += [C, X, 0, 0, X, C][h];
          G += [X, C, C, X, 0, 0][h];
          B += [0, 0, X, C, C, X][h];
          return {
            r: Math.round(R * 255),
            g: Math.round(G * 255),
            b: Math.round(B * 255),
            a: a || this.value.a
          };
        },

        toHex: function (h, s, b, a) {
          var rgb = this.toRGB(h, s, b, a);
          return '#' + ((1 << 24) | (parseInt(rgb.r, 10) << 16) | (parseInt(rgb.g, 10) << 8) | parseInt(rgb.b, 10)).toString(16).substr(1);
        }
      };
    }])
    .factory('Slider', ['Helper', function (Helper) {
      var
          slider = {
            maxLeft: 0,
            maxTop: 0,
            callLeft: null,
            callTop: null,
            knob: {
              top: 0,
              left: 0
            }
          },
          pointer = {};

      return {
        getSlider: function() {
          return slider;
        },
        getLeftPosition: function(event) {
          return Math.max(0, Math.min(slider.maxLeft, slider.left + ((event.pageX || pointer.left) - pointer.left)));
        },
        getTopPosition: function(event) {
          return Math.max(0, Math.min(slider.maxTop, slider.top + ((event.pageY || pointer.top) - pointer.top)));
        },
        setSlider: function (event, fixedPosition) {
          var
            target = Helper.closestSlider(event.target),
            targetOffset = Helper.getOffset(target, fixedPosition);
          slider.knob = target.children[0].style;
          slider.left = event.pageX - targetOffset.left - window.pageXOffset + targetOffset.scrollX;
          slider.top = event.pageY - targetOffset.top - window.pageYOffset + targetOffset.scrollY;

          pointer = {
            left: event.pageX,
            top: event.pageY
          };
        },
        setSaturation: function(event, fixedPosition) {
          slider = {
            maxLeft: 100,
            maxTop: 100,
            callLeft: 'setSaturation',
            callTop: 'setLightness'
          };
          this.setSlider(event, fixedPosition);
        },
        setHue: function(event, fixedPosition) {
          slider = {
            maxLeft: 0,
            maxTop: 100,
            callLeft: false,
            callTop: 'setHue'
          };
          this.setSlider(event, fixedPosition);
        },
        setAlpha: function(event, fixedPosition) {
          slider = {
            maxLeft: 0,
            maxTop: 100,
            callLeft: false,
            callTop: 'setAlpha'
          };
          this.setSlider(event, fixedPosition);
        },
        setKnob: function(top, left) {
          slider.knob.top = top + 'px';
          slider.knob.left = left + 'px';
        }
      };
    }])
    .directive('colorpicker', ['$document', '$compile', 'Color', 'Slider', 'Helper', function ($document, $compile, Color, Slider, Helper) {
      return {
        require: '?ngModel',
        restrict: 'A',
        link: function ($scope, elem, attrs, ngModel) {
          var
              thisFormat = attrs.colorpicker ? attrs.colorpicker : 'hex',
              isBackgroundSetting = angular.isDefined(attrs.backgroundSetting) ? true : false,
              position = angular.isDefined(attrs.colorpickerPosition) ? attrs.colorpickerPosition : 'bottom',
              inline = angular.isDefined(attrs.colorpickerInline) ? attrs.colorpickerInline : false,
              fixedPosition = angular.isDefined(attrs.colorpickerFixedPosition) ? attrs.colorpickerFixedPosition : false,
              target = angular.isDefined(attrs.colorpickerParent) ? elem.parent() : angular.element(document.body),
              withInput = angular.isDefined(attrs.colorpickerWithInput) ? attrs.colorpickerWithInput : false,
              inputTemplate = withInput ? '<input type="text" name="colorpicker-input">' : '';

          var
              closeButton = !inline ? '<button type="button" class="close close-colorpicker">&times;</button>' : '',
              template = isBackgroundSetting ?
                  '<div class="colorpicker dropdown">' +
                    '<div class="dropdown-menu">' +
                    '<colorpicker-saturation><i></i></colorpicker-saturation>' +
                    '<colorpicker-hue><i></i></colorpicker-hue>' +
                    '<colorpicker-alpha><i></i></colorpicker-alpha>' +
                    inputTemplate +
                    '</div>' +
                    '</div>'
                :
                  '<div class="colorpicker dropdown">' +
                      '<div class="dropdown-menu">' +
                      '<colorpicker-saturation><i></i></colorpicker-saturation>' +
                      '<colorpicker-hue><i></i></colorpicker-hue>' +
                      '<colorpicker-alpha><i></i></colorpicker-alpha>' +
                      '<colorpicker-preview></colorpicker-preview>' +
                      inputTemplate +
                      closeButton +
                      '</div>' +
                      '</div>',
              colorpickerTemplate = angular.element(template),
              pickerColor = Color,
              sliderAlpha,
              sliderHue = colorpickerTemplate.find('colorpicker-hue'),
              sliderSaturation = colorpickerTemplate.find('colorpicker-saturation'),
              colorpickerPreview = colorpickerTemplate.find('colorpicker-preview'),
              pickerColorPointers = colorpickerTemplate.find('i');

          $compile(colorpickerTemplate)($scope);

          if (withInput) {
            var pickerColorInput = colorpickerTemplate.find('input');
            pickerColorInput
                .on('mousedown', function(event) {
                  event.stopPropagation();
                })
                .on('keyup', function(event) {
                  var newColor = this.value;
                  elem.val(newColor);
                  if(ngModel) {
                    $scope.$apply(ngModel.$setViewValue(newColor));
                  }
                  event.stopPropagation();
                  event.preventDefault();
                });
            elem.on('keyup', function() {
              pickerColorInput.val(elem.val());
            });
          }

          var bindMouseEvents = function() {
            $document.on('mousemove', mousemove);
            $document.on('mouseup', mouseup);
          };

          if (thisFormat === 'rgba') {
            colorpickerTemplate.addClass('alpha');
            sliderAlpha = colorpickerTemplate.find('colorpicker-alpha');
            sliderAlpha
                .on('click', function(event) {
                  Slider.setAlpha(event, fixedPosition);
                  mousemove(event);
                })
                .on('mousedown', function(event) {
                  Slider.setAlpha(event, fixedPosition);
                  bindMouseEvents();
                });
          }

          sliderHue
              .on('click', function(event) {
                Slider.setHue(event, fixedPosition);
                mousemove(event);
              })
              .on('mousedown', function(event) {
                Slider.setHue(event, fixedPosition);
                bindMouseEvents();
              });

          sliderSaturation
              .on('click', function(event) {
                Slider.setSaturation(event, fixedPosition);
                mousemove(event);
              })
              .on('mousedown', function(event) {
                Slider.setSaturation(event, fixedPosition);
                bindMouseEvents();
              });

          if (fixedPosition) {
            colorpickerTemplate.addClass('colorpicker-fixed-position');
          }

          colorpickerTemplate.addClass('colorpicker-position-' + position);
		      if (inline === 'true') {
			      colorpickerTemplate.addClass('colorpicker-inline');
		      }

          target.append(colorpickerTemplate);

          if(ngModel) {
            ngModel.$render = function () {
              elem.val(ngModel.$viewValue);
            };
            $scope.$watch(attrs.ngModel, function(newVal) {
              update();

              if (withInput) {
                pickerColorInput.val(newVal);
              }
            });
          }

          elem.on('$destroy', function() {
            colorpickerTemplate.remove();
          });

          var previewColor = function () {
            try {
              colorpickerPreview.css('backgroundColor', pickerColor[thisFormat]());
            } catch (e) {
              colorpickerPreview.css('backgroundColor', pickerColor.toHex());
            }
            sliderSaturation.css('backgroundColor', pickerColor.toHex(pickerColor.value.h, 1, 1, 1));
            if (thisFormat === 'rgba') {
              sliderAlpha.css.backgroundColor = pickerColor.toHex();
            }
          };

          var mousemove = function (event) {
            var
                left = Slider.getLeftPosition(event),
                top = Slider.getTopPosition(event),
                slider = Slider.getSlider();

            Slider.setKnob(top, left);

            if (slider.callLeft) {
              pickerColor[slider.callLeft].call(pickerColor, left / 100);
            }
            if (slider.callTop) {
              pickerColor[slider.callTop].call(pickerColor, top / 100);
            }
            previewColor();
            var newColor = pickerColor[thisFormat]();
            elem.val(newColor);
            if(ngModel) {
              $scope.$apply(ngModel.$setViewValue(newColor));
            }
            if (withInput) {
              pickerColorInput.val(newColor);
            }
            return false;
          };

          var mouseup = function () {
            $document.off('mousemove', mousemove);
            $document.off('mouseup', mouseup);
          };

          var update = function () {
            pickerColor.setColor(elem.val());
            pickerColorPointers.eq(0).css({
              left: pickerColor.value.s * 100 + 'px',
              top: 100 - pickerColor.value.b * 100 + 'px'
            });
            pickerColorPointers.eq(1).css('top', 100 * (1 - pickerColor.value.h) + 'px');
            pickerColorPointers.eq(2).css('top', 100 * (1 - pickerColor.value.a) + 'px');
            previewColor();
          };

          var getColorpickerTemplatePosition = function() {
            var
                positionValue,
                positionOffset = Helper.getOffset(elem[0]);

            if(angular.isDefined(attrs.colorpickerParent)) {
              positionOffset.left = 0;
              positionOffset.top = 0;
            }

            if (position === 'top') {
              positionValue =  {
                'top': positionOffset.top - 147,
                'left': positionOffset.left
              };
            } else if (position === 'right') {
              positionValue = {
                'top': positionOffset.top,
                'left': positionOffset.left + 126
              };
            } else if (position === 'bottom') {
              positionValue = {
                'top': positionOffset.top + elem[0].offsetHeight + 2,
                'left': positionOffset.left
              };
            } else if (position === 'left') {
              positionValue = {
                'top': positionOffset.top,
                'left': positionOffset.left - 150
              };
            }
            return {
              'top': positionValue.top + 'px',
              'left': positionValue.left + 'px'
            };
          };

          var documentMousedownHandler = function() {
            hideColorpickerTemplate();
          };

          if(inline === false) {
            elem.on('click', function () {
              update();
              colorpickerTemplate
                .addClass('colorpicker-visible')
                .css(getColorpickerTemplatePosition());

              // register global mousedown event to hide the colorpicker
              $document.on('mousedown', documentMousedownHandler);
            });
          } else {
            update();
            colorpickerTemplate
              .addClass('colorpicker-visible')
              .css(getColorpickerTemplatePosition());
          }

          colorpickerTemplate.on('mousedown', function (event) {
            event.stopPropagation();
            event.preventDefault();
          });

          var emitEvent = function(name) {
            if(ngModel) {
              $scope.$emit(name, {
                name: attrs.ngModel,
                value: ngModel.$modelValue
              });
            }
          };

          var hideColorpickerTemplate = function() {
            if (colorpickerTemplate.hasClass('colorpicker-visible')) {
              colorpickerTemplate.removeClass('colorpicker-visible');
              emitEvent('colorpicker-closed');
              // unregister the global mousedown event
              $document.off('mousedown', documentMousedownHandler);
            }
          };

          colorpickerTemplate.find('button').on('click', function () {
            hideColorpickerTemplate();
          });
        }
      };
    }]);

(function () {
  "use strict";

  angular.module("risevision.widget.common.widget-button-toolbar", ["risevision.common.i18n"])
    .directive("widgetButtonToolbar", ["$templateCache", function ($templateCache) {
      return {
        restrict: "E",
        scope: {
          help: "@",
          contribute: "@",
          save: "&",
          cancel: "&",
          disableSave: "&"
        },
        template: $templateCache.get("_angular/widget-button-toolbar/widget-button-toolbar.html"),
        link: function ($scope, elem, attrs) {
          $scope.helpRef = "";
          $scope.contributeRef = "";

          if (typeof attrs.help !== "undefined" && attrs.help !== "") {
            $scope.helpRef = attrs.help;
          }

          if (typeof attrs.contribute !== "undefined" && attrs.contribute !== "") {
            $scope.contributeRef = attrs.contribute;
          }

        }
      };
    }]);
}());

(function(module) {
try { app = angular.module("risevision.widget.common.widget-button-toolbar"); }
catch(err) { app = angular.module("risevision.widget.common.widget-button-toolbar", []); }
app.run(["$templateCache", function($templateCache) {
  "use strict";
  $templateCache.put("_angular/widget-button-toolbar/widget-button-toolbar.html",
    "<div class=\"btn-toolbar sticky-buttons\">\n" +
    "  <button id=\"save\" class=\"btn btn-primary btn-fixed-width\" type=\"button\" ng-click=\"save()\" ng-disabled=\"disableSave()\">\n" +
    "    <span>{{\"common.save\" | translate}}</span>\n" +
    "    <i class=\"fa fa-white fa-check fa-lg icon-right\"></i>\n" +
    "  </button>\n" +
    "  <button id=\"cancel\" class=\"btn btn-default btn-fixed-width\" type=\"button\" ng-click=\"cancel()\">\n" +
    "    <span>{{\"common.cancel\" | translate}}</span>\n" +
    "    <i class=\"fa fa-white fa-times fa-lg icon-right\"></i>\n" +
    "  </button>\n" +
    "  <a type=\"button\" class=\"btn btn-rv-help btn-fixed-width\" target=\"_blank\" href={{helpRef}} ng-if=\"helpRef !== ''\">\n" +
    "    <span>{{\"common.help\" | translate}}</span>\n" +
    "    <i class=\"fa fa-question-circle fa-lg icon-right\"></i>\n" +
    "  </a>\n" +
    "  <a type=\"button\" class=\"btn btn-rv-help btn-fixed-width\" target=\"_blank\" href={{contributeRef}} ng-if=\"contributeRef !== ''\">\n" +
    "    <span>{{\"common.contribute\" | translate}}</span>\n" +
    "    <i class=\"fa fa-github fa-lg icon-right\"></i>\n" +
    "  </a>\n" +
    "</div>\n" +
    "");
}]);
})();

(function () {
  "use strict";

  angular.module("risevision.widget.common.tooltip", ["ui.bootstrap"])
    .directive("rvTooltip", [function () {
      return {
        restrict: "A",
        link: function($scope, element) {
          element.addClass("fa");
          element.addClass("fa-question-circle");
          element.addClass("fa-lg");
        }
      };
    }]);
}());

if (typeof angular !== "undefined") {
  angular.module("risevision.widget.common.storage-selector.config", [])
    .value("STORAGE_MODAL", "http://storage.risevision.com/storage-modal.html#/files/");
}

(function () {

  "use strict";

  angular.module("risevision.widget.common.storage-selector", [
    "ui.bootstrap",
    "risevision.widget.common.storage-selector.config"
  ])
  .directive("storageSelector", ["$window", "$templateCache", "$modal", "$sce", "$log", "STORAGE_MODAL",
    function($window, $templateCache, $modal, $sce, $log, STORAGE_MODAL){
      return {
        restrict: "EA",
        scope : {
          local: "@",
          useCtrl: "@",
          instanceTemplate: "@",
          companyId : "@"
        },
        template: $templateCache.get("storage-selector.html"),
        link: function (scope) {

          scope.storageUrl = "";

          scope.open = function() {
            var modalInstance = $modal.open({
              templateUrl: scope.instanceTemplate || "storage.html",
              controller: scope.useCtrl || "StorageCtrl",
              size: "lg",
              backdrop: true,
              resolve: {
                storageUrl: function () {
                  return {url: $sce.trustAsResourceUrl(scope.storageUrl)};
                }
              }
            });

            modalInstance.result.then(function (files) {
              // emit an event with name "files", passing the array of files selected from storage
              scope.$emit("picked", files);

            }, function () {
              $log.info("Modal dismissed at: " + new Date());
            });

          };

          if (scope.local){
            scope.storageUrl = STORAGE_MODAL + "local";
          } else {
            scope.$watch("companyId", function (companyId) {
              if (companyId) {
                scope.storageUrl = STORAGE_MODAL + companyId;
              }
            });
          }
        }
      };
   }
  ]);
})();



angular.module("risevision.widget.common.storage-selector")
  .controller("StorageCtrl", ["$scope", "$modalInstance", "storageUrl", "$window", "$log",
    function($scope, $modalInstance, storageUrl, $window/*, $log*/){

    $scope.storageUrl = storageUrl;

    $window.addEventListener("message", function (event) {
      var storageTest = "storage-stage-rva-test.risevision.com",
        storageProd = "storage.risevision.com";

      if (event.origin.indexOf(storageTest) === -1 && event.origin.indexOf(storageProd) === -1) {
        return;
      }

      if (Array.isArray(event.data)) {
        $modalInstance.close(event.data);
      } else if (typeof event.data === "string") {
        if (event.data === "close") {
          $modalInstance.dismiss("cancel");
        }
      }
    });

  }]);

(function(module) {
try { app = angular.module("risevision.widget.common.storage-selector"); }
catch(err) { app = angular.module("risevision.widget.common.storage-selector", []); }
app.run(["$templateCache", function($templateCache) {
  "use strict";
  $templateCache.put("storage-selector.html",
    "<button class=\"btn btn-widget-icon-storage\" ng-click=\"open()\" type=\"button\" />\n" +
    "<script type=\"text/ng-template\" id=\"storage.html\">\n" +
    "        <iframe class=\"modal-dialog\" scrolling=\"no\" marginwidth=\"0\" src=\"{{ storageUrl.url }}\"></iframe>\n" +
    "</script>\n" +
    "");
}]);
})();

(function () {
  "use strict";

  angular.module("risevision.widget.common.url-field", [
    "risevision.common.i18n",
    "risevision.widget.common.tooltip",
    "risevision.widget.common.storage-selector"
  ])
    .directive("urlField", ["$templateCache", "$log", function ($templateCache, $log) {
      return {
        restrict: "E",
        require: "?ngModel",
        scope: {
          url: "=",
          hideLabel: "@",
          hideStorage: "@",
          companyId: "@",
          fileType: "@"
        },
        template: $templateCache.get("_angular/url-field/url-field.html"),
        link: function (scope, element, attrs, ctrl) {

          function hasValidExtension(url, fileType) {
            var testUrl = url.toLowerCase(),
              extensions;

            switch(fileType) {
              case "image":
                extensions = [".jpg", ".jpeg", ".png", ".bmp", ".svg", ".gif"];
                break;
              case "video":
                extensions = [".webm", ".mp4", ".ogv", ".ogg"];
                break;
              default:
                extensions = [];
            }

            for (var i = 0, len = extensions.length; i < len; i++) {
              if (testUrl.indexOf(extensions[i]) !== -1) {
                return true;
              }
            }

            return false;
          }


          function testUrl(value) {
            var urlRegExp,
              isValid;

            /*
             Discussion
             http://stackoverflow.com/questions/37684/how-to-replace-plain-urls-with-links#21925491

             Using
             https://gist.github.com/dperini/729294
             Reasoning
             http://mathiasbynens.be/demo/url-regex */

            /* jshint ignore:start */
            urlRegExp = /^(?:(?:https?|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?$/i;
            /* jshint ignore:end */

            // Add http:// if no protocol parameter exists
            if (value.indexOf("://") === -1) {
              value = "http://" + value;
            }

            isValid = urlRegExp.test(value);

            if (isValid && typeof scope.fileType !== "undefined") {
              isValid = hasValidExtension(value, scope.fileType);
              if (!isValid) {
                scope.invalidType = scope.fileType;
              }
            } else {
              scope.invalidType = "url";
            }

            return isValid;
          }

          // By default enforce validation
          scope.doValidation = true;
          // A flag to set if the user turned off validation
          scope.forcedValid = false;
          // Validation state
          scope.valid = true;

          scope.invalidType = "url";

          scope.allowInitEmpty = (typeof attrs.initEmpty !== "undefined") ? true : false;

          if (!scope.hideStorage) {
            scope.$on("picked", function (event, data) {
              scope.url = data[0];
            });
          }

          scope.blur = function() {
            scope.$emit("urlFieldBlur");
          };

          scope.$watch("url", function (url) {
            if (typeof url !== "undefined" && url !== null) {

              if (url !== "" && scope.allowInitEmpty) {
                // ensure an empty "" value now gets validated
                scope.allowInitEmpty = false;
              }

              if (scope.doValidation && !scope.allowInitEmpty) {
                scope.valid = testUrl(scope.url);
              }
            }
          });

          scope.$watch("valid", function (valid) {
            if (ctrl) {
              $log.info("Calling $setValidity() on parent controller");
              ctrl.$setValidity("valid", valid);
            }
          });

          scope.$watch("doValidation", function (doValidation) {
            if(typeof scope.url !== "undefined") {
              if (doValidation) {
                scope.forcedValid = false;

                if (!scope.allowInitEmpty) {
                  scope.valid = testUrl(scope.url);
                }
              } else {
                scope.forcedValid = true;
                scope.valid = true;
              }
            }
          });

        }
      };
    }]);
}());

(function(module) {
try { app = angular.module("risevision.widget.common.url-field"); }
catch(err) { app = angular.module("risevision.widget.common.url-field", []); }
app.run(["$templateCache", function($templateCache) {
  "use strict";
  $templateCache.put("_angular/url-field/url-field.html",
    "<div class=\"form-group\" >\n" +
    "  <label ng-if=\"!hideLabel\">{{ \"url.label\" | translate }}</label>\n" +
    "  <div ng-class=\"{'input-group':!hideStorage}\">\n" +
    "    <input name=\"url\" type=\"text\" ng-model=\"url\" ng-blur=\"blur()\" class=\"form-control\" placeholder=\"http://\">\n" +
    "    <span class=\"input-url-addon\" ng-if=\"!hideStorage\"><storage-selector company-id=\"{{companyId}}\"></storage-selector></span>\n" +
    "  </div>\n" +
    "  <p ng-if=\"!valid && invalidType === 'url'\" class=\"text-danger\">{{ \"url.errors.url\" | translate }}</p>\n" +
    "  <p ng-if=\"!valid && invalidType === 'image'\" class=\"text-danger\">{{ \"url.errors.image\" | translate }}</p>\n" +
    "  <p ng-if=\"!valid && invalidType === 'video'\" class=\"text-danger\">{{ \"url.errors.video\" | translate }}</p>\n" +
    "  <div class=\"checkbox\" ng-show=\"forcedValid || !valid\">\n" +
    "    <label>\n" +
    "      <input name=\"validate-url\" ng-click=\"doValidation = !doValidation\" type=\"checkbox\"\n" +
    "             value=\"validate-url\" checked=\"checked\"> {{\"url.validate.label\" | translate}}\n" +
    "    </label>\n" +
    "    <span popover=\"{{'url.validate.tooltip' | translate}}\" popover-trigger=\"click\"\n" +
    "          popover-placement=\"top\" rv-tooltip></span>\n" +
    "  </div>\n" +
    "</div>\n" +
    "");
}]);
})();

(function () {
  "use strict";

  angular.module("risevision.widget.common.position-setting", ["risevision.common.i18n"])
    .directive("positionSetting", ["$templateCache", "$log", function ($templateCache/*, $log*/) {
      return {
        restrict: "E",
        scope: {
          position: "=",
          hideLabel: "@"
        },
        template: $templateCache.get("_angular/position-setting/position-setting.html"),
        link: function ($scope) {
          $scope.$watch("position", function(position) {
            if (typeof position === "undefined") {
              // set a default
              $scope.position = "top-left";
            }
          });
        }
      };
    }]);
}());

(function(module) {
try { app = angular.module("risevision.widget.common.position-setting"); }
catch(err) { app = angular.module("risevision.widget.common.position-setting", []); }
app.run(["$templateCache", function($templateCache) {
  "use strict";
  $templateCache.put("_angular/position-setting/position-setting.html",
    "<div class=\"row\">\n" +
    "  <div class=\"col-md-3\">\n" +
    "    <label ng-if=\"!hideLabel\"> {{'widgets.alignment' | translate}}</label>\n" +
    "    <select name=\"position\" ng-model=\"position\" class=\"form-control\">\n" +
    "      <option value=\"top-left\">{{'position.top.left' | translate}}</option>\n" +
    "      <option value=\"top-center\">{{'position.top.center' | translate}}</option>\n" +
    "      <option value=\"top-right\">{{'position.top.right' | translate}}</option>\n" +
    "      <option value=\"middle-left\">{{'position.middle.left' | translate}}</option>\n" +
    "      <option value=\"middle-center\">{{'position.middle.center' | translate}}</option>\n" +
    "      <option value=\"middle-right\">{{'position.middle.right' | translate}}</option>\n" +
    "      <option value=\"bottom-left\">{{'position.bottom.left' | translate}}</option>\n" +
    "      <option value=\"bottom-center\">{{'position.bottom.center' | translate}}</option>\n" +
    "      <option value=\"bottom-right\">{{'position.bottom.right' | translate}}</option>\n" +
    "    </select>\n" +
    "  </div>\n" +
    "</div>\n" +
    "");
}]);
})();

(function () {
  "use strict";

  angular.module("risevision.widget.common.background-image-setting", [
    "risevision.common.i18n",
    "colorpicker.module",
    "risevision.widget.common.url-field",
    "risevision.widget.common.position-setting",
    "risevision.widget.common.background-image"
  ])
    .directive("backgroundImageSetting", ["$templateCache", "$log", function ($templateCache/*, $log*/) {
      return {
        restrict: "E",
        scope: {
          background: "=",
          companyId: "@"
        },
        template: $templateCache.get("_angular/background-image-setting/background-image-setting.html"),
        link: function (scope) {

          scope.defaultSetting = {
            color: "rgba(255,255,255,0)",
            useImage: false,
            image: {
              url: "",
              position: "top-left",
              scale: true
            }
          };

          scope.defaults = function(obj) {
            if (obj) {
              for (var i = 1, length = arguments.length; i < length; i++) {
                var source = arguments[i];

                for (var prop in source) {
                  if (obj[prop] === void 0) {
                    obj[prop] = source[prop];
                  }
                }
              }
            }
            return obj;
          };

          scope.imageLoaded = false;
          scope.imageUrl = "";

          scope.$watch("background", function(background) {
            scope.defaults(background, scope.defaultSetting);
          });

          scope.$watch("background.image.url", function (newUrl, oldUrl) {
            /* In the context of being used in a widget settings, this scenario happens only once when settings
             initialize and have previously been saved. This will trigger the image to load/display.
             */
            if (newUrl !== "" && typeof oldUrl === "undefined") {
              scope.imageUrl = newUrl;
            }
          });

          scope.$on("backgroundImageLoad", function (event, loaded) {
            scope.$apply(function () {
              scope.imageLoaded = loaded;
            });

          });

          scope.$on("urlFieldBlur", function () {
            scope.imageUrl = scope.background.image.url;
          });

        }
      };
    }]);
}());

(function () {
  "use strict";

  angular.module("risevision.widget.common.background-image", [])
    .directive("backgroundImage", ["$log", function (/*$log*/) {
      return {
        restrict: "A",
        link: function(scope, element) {
          element.bind("load", function() {
            scope.$emit("backgroundImageLoad", true);
          });

          element.bind("error", function () {
            scope.$emit("backgroundImageLoad", false);
          });
        }
      };
    }]);
}());

(function(module) {
try { app = angular.module("risevision.widget.common.background-image-setting"); }
catch(err) { app = angular.module("risevision.widget.common.background-image-setting", []); }
app.run(["$templateCache", function($templateCache) {
  "use strict";
  $templateCache.put("_angular/background-image-setting/background-image-setting.html",
    "<!-- Color -->\n" +
    "<div class=\"row\">\n" +
    "  <div class=\"col-md-3\">\n" +
    "      <div class=\"input-group\">\n" +
    "        <input class=\"form-control\" colorpicker=\"rgba\" colorpicker-parent=\"true\" background-setting type=\"text\" ng-model=\"background.color\">\n" +
    "        <span class=\"input-group-addon color-wheel\"></span>\n" +
    "      </div>\n" +
    "  </div>\n" +
    "</div>\n" +
    "<!-- Image Choice -->\n" +
    "<div class=\"checkbox\">\n" +
    "  <label>\n" +
    "    <input name=\"choice\" type=\"checkbox\" ng-model=\"background.useImage\"> {{\"background.choice\" | translate}}\n" +
    "  </label>\n" +
    "</div>\n" +
    "<div id=\"backgroundImageControls\" ng-if=\"background.useImage\">\n" +
    "  <!-- Image Placeholder -->\n" +
    "  <div class=\"form-group\">\n" +
    "    <div ng-if=\"!imageLoaded\" class=\"image-placeholder\">\n" +
    "      <i class=\"fa fa-image\"></i>\n" +
    "    </div>\n" +
    "    <!-- Image -->\n" +
    "    <div ng-show=\"imageLoaded\" class=\"row\">\n" +
    "      <div class=\"col-xs-5 col-sm-3 col-md-2\">\n" +
    "        <img ng-src=\"{{imageUrl}}\" background-image class=\"img-rounded img-responsive\">\n" +
    "      </div>\n" +
    "    </div>\n" +
    "  </div>\n" +
    "  <!-- Image URL -->\n" +
    "  <url-field id=\"backgroundImageUrl\" url=\"background.image.url\"\n" +
    "             file-type=\"image\"\n" +
    "             hide-label=\"true\"\n" +
    "             company-id=\"{{companyId}}\"\n" +
    "             ng-model=\"urlentry\" valid></url-field>\n" +
    "  <!-- Position -->\n" +
    "  <position-setting position=\"background.image.position\" hide-label=\"true\"></position-setting>\n" +
    "  <!-- Scale to fit -->\n" +
    "  <div class=\"checkbox\">\n" +
    "    <label>\n" +
    "      <input name=\"scale\" type=\"checkbox\" ng-model=\"background.image.scale\"> {{\"background.image.scale\" | translate}}\n" +
    "    </label>\n" +
    "  </div>\n" +
    "</div>\n" +
    "\n" +
    "");
}]);
})();

(function () {
  "use strict";

  angular.module("risevision.widget.common.video-setting", [
    "risevision.common.i18n",
    "ui.bootstrap-slider"
  ])
    .directive("videoSetting", ["$templateCache", "$log", function ($templateCache/*, $log*/) {
      return {
        restrict: "E",
        scope: {
          video: "="
        },
        template: $templateCache.get("_angular/video-setting/video-setting.html"),
        link: function ($scope) {
          $scope.defaultSetting = {
            autoplay: true,
            scaleToFit: true,
            volume: 50
          };

          $scope.defaults = function(obj) {
            if (obj) {
              for (var i = 1, length = arguments.length; i < length; i++) {
                var source = arguments[i];

                for (var prop in source) {
                  if (obj[prop] === void 0) {
                    obj[prop] = source[prop];
                  }
                }
              }
            }
            return obj;
          };

          $scope.$watch("video", function(video) {
            $scope.defaults(video, $scope.defaultSetting);
          });

        }
      };
    }]);
}());

(function(module) {
try { app = angular.module("risevision.widget.common.video-setting"); }
catch(err) { app = angular.module("risevision.widget.common.video-setting", []); }
app.run(["$templateCache", function($templateCache) {
  "use strict";
  $templateCache.put("_angular/video-setting/video-setting.html",
    "<div class=\"section\">\n" +
    "  <h5>{{\"video.heading\" | translate}}</h5>\n" +
    "  <div class=\"form-group\">\n" +
    "    <div class=\"checkbox\">\n" +
    "      <label>\n" +
    "        <input name=\"video-autoplay\" type=\"checkbox\" ng-model=\"video.autoplay\"> {{\"video.autoplay.label\" | translate}}\n" +
    "      </label>\n" +
    "    </div>\n" +
    "  </div>\n" +
    "  <div class=\"checkbox\">\n" +
    "    <label>\n" +
    "      <input name=\"video-scale\" type=\"checkbox\" ng-model=\"video.scaleToFit\"> {{\"widgets.scale-to-fit\" | translate}}\n" +
    "    </label>\n" +
    "  </div>\n" +
    "  <label>{{\"video.volume.label\" | translate}}</label>\n" +
    "  <div>\n" +
    "    <slider orientation=\"horizontal\" handle=\"round\" ng-model=\"video.volume\" min=\"0\" step=\"1\" max=\"100\"></slider>\n" +
    "  </div>\n" +
    "</div>\n" +
    "");
}]);
})();

/* global config: true */
/* exported config */
if (typeof config === "undefined") {
  var config = {
    SKIN: "/rise-common/scripts/jw-player/skins/six.xml"
  };

  if (typeof angular !== "undefined") {
    angular.module("risevision.common.i18n.config", [])
      .constant("LOCALES_PREFIX", "locales/translation_")
      .constant("LOCALES_SUFIX", ".json");
  }
}

angular.module("risevision.widget.video.settings", [
  "risevision.common.i18n",
  "risevision.widget.common",
  "risevision.widget.common.video-setting",
  "risevision.widget.common.widget-button-toolbar",
  "risevision.widget.common.tooltip",
  "risevision.widget.common.background-image-setting",
  "risevision.widget.common.url-field"]);

angular.module("risevision.widget.common", []);

angular.module("risevision.widget.common")
  .controller("settingsController", ["$scope", "settingsSaver", "settingsGetter", "settingsCloser",
    function ($scope, settingsSaver, settingsGetter, settingsCloser) {

    $scope.settings = { params: {}, additionalParams: {}};
    $scope.alerts = [];

    $scope.getAdditionalParam = function (name, defaultVal) {
      var val = $scope.settings.additionalParams[name];
      if(angular.isUndefined(val)) {
        return defaultVal;
      }
      else {
        return val;
      }
    };

    $scope.setAdditionalParam = function (name, val) {
      $scope.settings.additionalParams[name] = val;
    };

    $scope.loadAdditionalParams = function () {
      settingsGetter.getAdditionalParams().then(function (additionalParams) {
        $scope.settings.additionalParams = additionalParams;
        $scope.$broadcast("loadAdditionalParams", additionalParams);
      },
      function (err) {alert (err); });
    };

    $scope.setAdditionalParams = function (name, val) {
      $scope.settings.additionalParams[name] = val;
    };

    $scope.saveSettings = function () {
      //clear out previous alerts, if any
      $scope.alerts = [];

      $scope.$broadcast("collectAdditionalParams");

      settingsSaver.saveSettings($scope.settings).then(function () {
        //TODO: perhaps show some indicator in UI?
      }, function (err) {
        $scope.alerts = err.alerts;
      });

    };

    $scope.closeSettings = function() {
      settingsCloser.closeSettings().then(function () {
        //TODO:
      }, function (err) {
        $scope.alerts = err.alerts;
      });

    };

    $scope.settings.params = settingsGetter.getParams();
    $scope.loadAdditionalParams();
  }])

  .directive("scrollOnAlerts", function() {
    return {
      restrict: "A", //restricts to attributes
      scope: false,
      link: function($scope, $elm) {
        $scope.$watchCollection("alerts", function (newAlerts, oldAlerts) {
          if(newAlerts.length > 0 && oldAlerts.length === 0) {
            $("body").animate({scrollTop: $elm.offset().top}, "fast");
          }
        });
      }
    };
});

angular.module("risevision.widget.common")
  .constant("STORAGE_FILE_URL_BASE", "storage.googleapis.com/risemedialibrary-")
  .constant("STORAGE_FOLDER_URL_BASE", "googleapis.com/storage/")
  .factory("commonSettings", ["$log", "STORAGE_FILE_URL_BASE", "STORAGE_FOLDER_URL_BASE",
    function ($log, STORAGE_FILE_URL_BASE, STORAGE_FOLDER_URL_BASE) {

    var factory = {
      getStorageUrlData: function (url) {
        var storage = {},
          str, arr, params, pair;

        function getStorageType(storageUrl) {
          if (storageUrl.indexOf(STORAGE_FILE_URL_BASE) !== -1) {
            return "file";
          }

          if (storageUrl.indexOf(STORAGE_FOLDER_URL_BASE) !== -1) {
            return "folder";
          }

          return null;
        }

        function getCompanyId(storageUrl) {
          var p = storageUrl.split("risemedialibrary-");

          return p[1].slice(0, p[1].indexOf("/"));
        }

        if (getStorageType(url) === "file") {
          str = url.split(STORAGE_FILE_URL_BASE)[1];
          str = decodeURIComponent(str.slice(str.indexOf("/") + 1));
          arr = str.split("/");

          storage.companyId = getCompanyId(url);
          storage.fileName = arr.pop();
          storage.folder = arr.length > 0 ? arr.join("/") : "";

          if (storage.folder !== "") {
            // add ending "/" to the folder path
            storage.folder += "/";
          }
        }
        else if (getStorageType(url) === "folder") {
          params = url.split("?");

          for (var i = 0; i < params.length; i++) {
            pair = params[i].split("=");

            if (pair[0] === "prefix" && typeof pair[1] !== "undefined" && pair[1] !== "") {
              storage.companyId = getCompanyId(url);
              storage.folder = decodeURIComponent(pair[1]);
              storage.fileName = "";
              break;
            }
          }
        }

        return storage;
      }
    };

    return factory;
  }]);

angular.module("risevision.widget.common")
  .factory("gadgetsApi", ["$window", function ($window) {
    return $window.gadgets;
  }]);

angular.module("risevision.widget.common")
  .service("i18nLoader", ["$window", "$q", function ($window, $q) {
    var deferred = $q.defer();

    $window.i18n.init({ 
      fallbackLng: "en",
      resGetPath: "locales/__ns_____lng__.json"
    }, function () {
      deferred.resolve($window.i18n);
    });

    this.get = function () {
      return deferred.promise;
    };
  }]);

angular.module("risevision.widget.common")
  .factory("imageValidator", ["$q", function ($q) {
    var factory = {
      // Verify that URL is a valid image file.
      isImage: function(src) {
        var deferred = $q.defer(),
          image = new Image();

        image.onload = function() {
          deferred.resolve(true);
        };

        image.onerror = function() {
          deferred.resolve(false);
        };

        image.src = src;

        return deferred.promise;
      }
    };

    return factory;
  }]);

angular.module("risevision.widget.common")
  .service("settingsSaver", ["$q", "$log", "gadgetsApi", "settingsParser",
  function ($q, $log, gadgetsApi, settingsParser) {

    this.saveSettings = function (settings, validator) {
      var deferred = $q.defer();
      var alerts = [], str = "";

      settings = processSettings(settings);

      if (validator) {
        alerts = validator(settings);
      }

      if(alerts.length > 0) {
        $log.debug("Validation failed.", alerts);
        deferred.reject({alerts: alerts});
      }

      if (settings.params.hasOwnProperty("layoutURL")) {
        // ensure the url is the start of the string
        str += settings.params.layoutURL + "?";
        // delete this property so its not included below in encodeParams call
        delete settings.params.layoutURL;
      }

      str += settingsParser.encodeParams(settings.params);

      var additionalParamsStr =
        settingsParser.encodeAdditionalParams(settings.additionalParams);

      gadgetsApi.rpc.call("", "rscmd_saveSettings", function (result) {
        $log.debug("encoded settings", JSON.stringify(result));
        $log.debug("Settings saved. ", settings);

        deferred.resolve(result);
      }, {
        params: str,
        additionalParams: additionalParamsStr
      });

      return deferred.promise;
    };

    function processSettings(settings) {
      var newSettings = angular.copy(settings);

      delete newSettings.params.id;
      delete newSettings.params.companyId;
      delete newSettings.params.rsW;
      delete newSettings.params.rsH;

      return newSettings;
    }

  }])

  .service("settingsGetter", ["$q", "gadgetsApi", "$log", "settingsParser", "$window", "defaultSettings",
    function ($q, gadgetsApi, $log, settingsParser, $window, defaultSettings) {

      this.getAdditionalParams = function () {
        var deferred = $q.defer();
        var defaultAdditionalParams = defaultSettings.additionalParams || {};
        gadgetsApi.rpc.call("", "rscmd_getAdditionalParams", function (result) {
          if(result) {
            result = settingsParser.parseAdditionalParams(result);
          }
          else {
            result = {};
          }
          $log.debug("getAdditionalParams returns ", result);
          deferred.resolve(angular.extend(defaultAdditionalParams, result));
        });

        return deferred.promise;
      };

      this.getParams = function () {
        var defaultParams = defaultSettings.params || {};
        return angular.extend(defaultParams,
          settingsParser.parseParams($window.location.search));
      };
  }])

  .service("settingsParser", [function () {
    this.parseAdditionalParams = function (additionalParamsStr) {
      if(additionalParamsStr) {
        return JSON.parse(additionalParamsStr);
      }
      else {
        return {};
      }
    };

    this.encodeAdditionalParams = function (additionalParams) {
      return JSON.stringify(additionalParams);
    };

    this.encodeParams = function (params) {
      var str = [];
      for(var p in params) {
        if (params.hasOwnProperty(p)) {
          var value;
          if (typeof params[p] === "object") {
            value = JSON.stringify(params[p]);
          }
          else {
            value = params[p];
          }
          str.push("up_" + encodeURIComponent(p) + "=" + encodeURIComponent(value));
        }
      }

      return str.join("&");
    };

    function stripPrefix(name) {
      if(name.indexOf("up_") === 0) {
        return name.slice(3);
      }
      else {
        return null;
      }
    }

    this.parseParams = function (paramsStr) {
      //get rid of preceeding "?"
      if(paramsStr[0] === "?") {
        paramsStr = paramsStr.slice(1);
      }
      var result = {};
      var vars = paramsStr.split("&");
      for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split("=");
        var name = stripPrefix(decodeURIComponent(pair[0]));
        //save settings only if it has up_ prefix. Ignore otherwise
        if (name) {
          try {
            result[name] = JSON.parse(decodeURIComponent(pair[1]));
          }
          catch (e) {
            result[name] = decodeURIComponent(pair[1]);
          }
        }
      }
      return result;
    };

  }])

  .service("settingsCloser", ["$q", "$log", "gadgetsApi",
  function ($q, $log, gadgetsApi) {

    this.closeSettings = function () {
      var deferred = $q.defer();

      gadgetsApi.rpc.call("", "rscmd_closeSettings", function () {
        deferred.resolve(true);
      });

      return deferred.promise;
    };

  }])

  .value("defaultSettings", {});

(function (angular) {
  "use strict";

  angular.module("risevision.widget.common.visualization", [])
    .factory("visualizationApi", ["$q", "$window", function ($q, $window) {
      var deferred = $q.defer();
      var promise;

      var factory = {
        get: function () {
          if (!promise) {
            promise = deferred.promise;
            if (!$window.google.visualization) {
              $window.google.setOnLoadCallback(function () {
                deferred.resolve($window.google.visualization);
              });
            }
            else {
              deferred.resolve($window.google.visualization);
            }
          }
          return promise;
        }
      };
      return factory;

    }]);

})(angular);

angular.module("risevision.widget.video.settings")
  .controller("videoSettingsController", ["$scope", "$log", "commonSettings",
    function ($scope, $log, commonSettings) {

      $scope.$watch("settings.additionalParams.url", function (url) {
        if (typeof url !== "undefined" && url !== "") {
          if ($scope.settingsForm.videoUrl.$valid) {
            $scope.settings.additionalParams.videoStorage = commonSettings.getStorageUrlData(url);
          } else {
            $scope.settings.additionalParams.videoStorage = {};
          }
        }
      });

      $scope.$watch("settings.additionalParams.background.image.url", function (url) {
        if (typeof url !== "undefined" && url !== "") {
          if ($scope.settingsForm.background.$valid) {
            $scope.settings.additionalParams.backgroundStorage = commonSettings.getStorageUrlData(url);
          } else {
            $scope.settings.additionalParams.backgroundStorage = {};
          }
        }
      });

    }])
  .value("defaultSettings", {
    params: {},
    additionalParams: {
      url: "",
      videoStorage: {},
      video: {},
      background: {},
      backgroundStorage: {}
    }
  });

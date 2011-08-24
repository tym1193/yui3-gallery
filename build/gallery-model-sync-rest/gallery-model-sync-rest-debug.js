YUI.add('gallery-model-sync-rest', function(Y) {

/**
An Extension which provides a RESTful HTTP sync implementation that can be mixed
into a Model or ModelList subclass.

@module gallery-model-sync-rest
**/

/**
An Extension which provides a RESTful HTTP sync implementation that can be mixed
into a Model or ModelList subclass.

This makes it trivial for your Model or ModelList subclasses communicate and
transmit JSON data via RESTful HTTP. In most cases you'll only need to provide a
value for `root` when sub-classing Model, and only provide a value for `url`
when sub-classing ModelList.

@example
    var User = Y.Base.create('user', Y.Model, [Y.ModelSync.REST], {
        root : '/user'
    }, {
        ATTRS : {
            name : {}
        }
    });

    var Users = Y.Base.create('users', Y.ModelList, [Y.ModelSync.REST], {
        model   : User,
        url     : '/user'
    });

@class ModelSync.REST
@extension Model ModelList
**/

var RESTSync,

    Lang        = Y.Lang,
    sub         = Lang.sub,
    isValue     = Lang.isValue,
    isString    = Lang.isString,
    isNumber    = Lang.isNumber,
    isFunction  = Lang.isFunction;

// *** RESTSync *** //

RESTSync = function () {};

/**
Static hash lookup table of RESTful HTTP methods corresponding to CRUD actions.

@property HTTP_METHODS
@type Object
@static
**/
RESTSync.HTTP_METHODS = {
    'create': 'POST',
    'read'  : 'GET',
    'update': 'PUT',
    'delete': 'DELETE'
};

/**
Default headers used with all XHRs.

These headers will be merged with any request-specific headers, and the request-
specific headers will take presidence.

@property HTTP_HEADERS
@type Object
@static
@default
    {
        'Accept'        : 'application/json',
        'Content-Type'  : 'application/json'
    }
**/
RESTSync.HTTP_HEADERS = {
    'Accept'        : 'application/json',
    'Content-Type'  : 'application/json'
};

/**
Default number of milliseconds before the XHR will timeout/abort.

This can be overridden on a per-request basis.

@property HTTP_TIMEOUT
@type Number
@static
@default undefined
**/

/**
Static flag to use the HTTP POST method instead of PUT or DELETE.

If the server-side HTTP framework isn't RESTful, setting this flag to `true`
will cause all PUT and DELETE requests to instead use the POST HTTP method, and
add a X-HTTP-Method-Override HTTP header with the value of the method type which
was overridden.

@property EMULATE_HTTP
@type Boolean
@default false
@static
**/
RESTSync.EMULATE_HTTP = false;

RESTSync.prototype = {

    // *** Public Properties *** //

    /**
    A String which represents the root or collection part of the URL space which
    relates to a Model or ModelList. Usually this value should be same for all
    instances of a specific Model/ModelList type.

    When sub-classing Y.Model, most of the time you'll want to just override
    this property, and let the URLs for the XHRs be generated by convention. If
    the `root` String ends with a trailing-slash, XHR URLs will also end with a
    '/'; if the `root` does not end with a slash, neither will the XHR URLs.

    @example
        var User = Y.Base.create('user', Y.Model, [Y.ModelSync.REST], {
            root : '/user/'
        }, {
            ATTRS : {
                name : {}
            }
        });

        var myUser = new User({ id: '123' });
        myUser.load(); // will GET the User data from: /user/123/

        var newUser = new User({ name: 'Eric Ferraiuolo' });
        newUser.save(); // will POST the User data to: /user/

    When sub-classing Y.ModelList, usually you'll want to ignore configuring the
    `root` and instead just set the `url` to a String; but if you just specify a
    value for `root`, things will work correctly.

    @property root
    @type String
    @default ''
    **/
    root : '',

    /**
    A Function or String which is used to generate or specify the URL for the
    XHRs. While, this property can be defined for each Model/ModelList instance,
    usually you'll want to use a Function or String pattern instead.

    If the `url` property is a Function, it should return the String that should
    be used as the URL. The Function will be called before each request.

    If the `url` property is a String, it will be processed by `Y.Lang.sub()`;
    this is useful when the URLs for a Model type match a specific pattern and
    can use simple replacement tokens:

    @example
        '/user/{id}'

    **Note:** String substitution on the `url` property will only happen for
    Y.Model subclasses, and only String and Number ATTR values will be
    substituted; do not expect something fancy to happen with Object, Array, or
    Boolean values; they will simply be ignored.

    When sub-classing Y.Model, you will probably be able to rely on the default
    implementation of `url()` which works in conjunction with the `root`
    property and whether the Model instance is new or not (i.e. has an `id`). If
    the `root` property ends with a trailing-slash, the generated URL for the
    specific Model instance will also end with a trailing-slash.

    If your URL-space has plural root or collection URLs, while the specific
    item resources are under a singular name, e.g. /users (plural) and /user/123
    (singular); you'll probably want to configure the `root` and `url`
    properties like this:

    @example
        var User = Y.Base.create('user', Y.Model, [Y.ModelSync.REST], {
            root : '/users',
            url  : '/user/{id}'
        }, {
            ATTRS : {
                name : {}
            }
        });

        var myUser = new User({ id: '123' });
        myUser.load(); // Will GET the User data from: /user/123

        var newUser = new User({ name: 'Eric Ferraiuolo' });
        newUser.save(); // Will POST the User data to: /users

    When sub-classing Y.ModelList, you probably just need to specify a simple
    String for the `url` property and leave `root` to be the default value.

    @property
    @type Function|String
    @method url
    @return {String} URL to for the XHR to the server.
    **/
    url : function () {
        var root = this.root,
            url;

        if (this instanceof Y.ModelList || this.isNew()) {
            return root;
        }

        url = this.getAsURL('id');
        if (root && root.charAt(root.length - 1) === '/') {
            // Add trailing-slash because root has a trailing-slash.
            url += '/';
        }

        return this._joinURL(url);
    },

    // *** Lifecycle Methods *** //

    initializer : function (config) {
        config || (config = {});
        isValue(config.url) && (this.url = config.url);
    },

    // *** Public Methods *** //

    /**
    Communicates with a RESTful HTTP server by sending and receiving JSON data
    via XHRs.

    This method is called internally by load(), save(), and destroy().

    @method sync
    @param {String} action Sync action to perform. May be one of the following:

      * create: Store a newly-created model for the first time.
      * delete: Delete an existing model.
      * read  : Load an existing model.
      * update: Update an existing model.

    @param {Object} [options] Sync options.
      @param {Object} [options.headers] The HTTP headers to mix with the default
        headers specified by the `headers` property.
      @param {Number} [options.timeout] The number of milliseconds before the
        request will timeout and be aborted.
    @param {callback} [callback] Called when the sync operation finishes.
      @param {Error|null} callback.err If an error occurred, this parameter will
        contain the error. If the sync operation succeeded, _err_ will be
        falsy.
      @param {Any} [callback.response] The server's response. This value will
        be passed to the parse() method, which is expected to parse it and
        return an attribute hash.
    **/
    sync : function (action, options, callback) {
        options || (options = {});

        var url     = this._getURL(),
            method  = RESTSync.HTTP_METHODS[action],
            headers = Y.merge(RESTSync.HTTP_HEADERS, options.headers),
            timeout = options.timeout || RESTSync.HTTP_TIMEOUT,
            entity;

        // Prepare the content if we are sending data to the server.
        if (method === 'POST' || method === 'PUT') {
            entity = Y.JSON.stringify(this);
        } else {
            // Remove header, no content is being sent.
            delete headers['Content-Type'];
        }

        // Setup HTTP emulation for older servers if we need it.
        if (RESTSync.EMULATE_HTTP &&
                (method === 'PUT' || method === 'DELETE')) {
            // Pass along original method type in the headers.
            headers['X-HTTP-Method-Override'] = method;
            // Fall-back to using POST method type.
            method = 'POST';
        }

        // Setup and send the XHR.
        Y.io(url, {
            method  : method,
            headers : headers,
            data    : entity,
            timeout : timeout,
            on      : {
                success : function (txId, res) {
                    if (isFunction(callback)) {
                        callback(null, res.responseText);
                    }
                },
                failure : function (txId, res) {
                    if (isFunction(callback)) {
                        callback({
                            code: res.status,
                            msg : res.statusText
                        }, res.responseText);
                    }
                }
            }
        });
    },

    // *** Protected Methods *** //

    /**
    Helper method to return the URL to use when making the XHR to the server.

    This method correctly handles variations of the `url` property/method.

    @method _getURL
    @return {String} the URL for the XHR
    @protected
    **/
    _getURL : function () {
        var url = this.url,
            data;

        if (isFunction(url)) {
            return this.url();
        }

        if (this instanceof Y.Model) {
            data = {};
            Y.Object.each(this.toJSON(), function (v, k) {
                if (isString(v) || isNumber(v)) {
                    // URL-encode any String or Number values.
                    data[k] = encodeURIComponent(v);
                }
            });

            // Substitute placeholders with the URL-encoded data values.
            url = sub(url, data);
        }

        return url || this.root;
    },

    /**
    Joins the `root` URL to the specified _url_, normalizing leading/trailing
    `/` characters.

    Copied from YUI 3's `Y.Controller` Class: by Ryan Grove (Yahoo! Inc.)
    https://github.com/yui/yui3/blob/master/src/app/js/controller.js

    @example
        model.root = '/foo'
        model._joinURL('bar');  // => '/foo/bar'
        model._joinURL('/bar'); // => '/foo/bar'

        model.root = '/foo/'
        model._joinURL('bar');  // => '/foo/bar'
        model._joinURL('/bar'); // => '/foo/bar'

    @method _joinURL
    @param {String} url URL to append to the `root` URL.
    @return {String} Joined URL.
    @protected
    **/
    _joinURL: function (url) {
        var root = this.root;

        if (url.charAt(0) === '/') {
            url = url.substring(1);
        }

        return root && root.charAt(root.length - 1) === '/' ?
                root + url :
                root + '/' + url;
    }

};

// *** Namespace *** //

Y.namespace('ModelSync').REST = RESTSync;


}, '@VERSION@' ,{skinnable:false, requires:['io-base', 'json-stringify']});

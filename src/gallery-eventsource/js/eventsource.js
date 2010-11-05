
/*global EventSource*/

    var useNative = typeof EventSource != "undefined",
        YUIEvenSourceProto;

    function YUIEventSource(url){
    
        Y.Event.Target.call(this);
    
        /**
         * The URL or the server-sent events.
         * @type String
         * @property url
         */
        this.url = url;
    
    
        /**
         * The current state of the object. Possible values are 0 for connecting,
         * 1 for connected, and 2 for disconnected.
         * @type int
         * @property readyState
         */
        this.readyState = 0;
        
        /**
         * Object used to communicate with the server. May be an XHR or an
         * EventSource.
         * @type XMLHttpRequest|EventSource
         * @property _transport
         * @private
         */
        this._transport = null;
        
        //initialize the object
        this._init();
    
    }
    
    var YUIEventSourceProto;
    
    //use native if available
    if (useNative){
        YUIEventSourceProto = {
            
            _init: function(){
                var src = new EventSource(this.url),
                    that = this;
                    
                //map common events to custom events
                //note readyState must change before firing events
                src.onopen = 
                    src.onmessage =   
                    src.onerror = Y.bind(function(event){                    
                        switch(event.type){
                            case "open":
                                this.readyState = 1;
                                this.fire({type:"open"});
                                break;
                            case "message":
                                this.fire({type: "message", data: event.data });
                                break;
                            case "error":
                                this.readyState = 2;
                                this.fire({type:"error"});
                                break;              
                            //no default
                        }                    
                    }, this);
                
                this._transport = src;                
            },
            
            close: function(){
                this._transport.close();
                this.readyState = 2;
            },
            
            /*
             * Must override attach for custom server-sent events. Since
             * there's no catchall for all server-sent events, must assign
             * event handlers directly to the EventSource object.
             */
            on: function( type , fn , el , context , args){
                var that = this;
                if (type != "message" && type != "error" && type != "open"){
                    this._transport.addEventListener(type, function(event){
                        that.fire({
                            type:   event.type,
                            data:   event.data,
                            id:     event.id
                        });
                    }, false);
                }
                
                //call superclass method
                Y.Event.Target.prototype.on.apply(this, arguments);
            }
            
            //TODO: Need detach override too?

        };
    
    } else {
    
        YUIEventSourceProto = {
            
            /**
             * Initializes the EventSource object. Either creates an EventSource
             * instance or an XHR to mimic the functionality.
             * @method _init
             * @return {void}
             * @private
             */
            _init: function(){
                var src,
                    that = this;
                    
                /**
                 * Keeps track of where in the response buffer to start
                 * evaluating new data. Only used when native EventSource
                 * is not available.
                 * @type int
                 * @property _lastIndex
                 * @private
                 */
                this._lastIndex = 0;
                
                /**
                 * Keeps track of the last event ID received from the server.
                 * Only used when native EventSource is not available.
                 * @type variant
                 * @property _lastEventId
                 * @private
                 */
                this._lastEventId = null;
                
                //use appropriate XHR object as transport
                if (typeof XMLHttpRequest != "undefined"){ //most browsers
                    src = new XMLHttpRequest();
                } else if (typeof ActiveXObject != "undefined"){    //IE6
                    src = new ActiveXObject("MSXML2.XMLHttp");
                }
                
                src.open("get", this.url, true);
                    
                /*
                 * IE < 8 will not have multiple readyState 3 calls, so
                 * those will go to readyState 4 and effectively become
                 * long-polling requests. All others will have a hanging
                 * GET request that receives continual information over
                 * the same connection.
                 */
                src.onreadystatechange = function(){
                
                    //streaming XHR will start getting data at this point
                    if (src.readyState == 3){
                    
                        //verify that the HTTP content type is correct, if not, error out
                        if (src.getResponseHeader("Content-type") != "text/event-stream"){
                            that.close();
                            that.readyState = 2;
                            that.fire({type:"error"});
                            return;
                        }
                    
                        //means content type is correct, keep going
                        that._signalOpen();
                        
                        //IE6 and IE7 throw an error when trying to access responseText here
                        try {
                            that._processIncomingData(src.responseText);
                        } catch(ex){
                            //noop
                        }
                    } else if (src.readyState == 4 && that.readyState < 2){
                        that._signalOpen();
                        that._validateResponse();
                    }
                };
                
                this._transport = src;                
                
                //wait until this JS task is done before firing
                //so as not to lose any events
                setTimeout(Y.bind(function(){                    
                    //close() might have been called before this executes
                    if (this.readyState != 2){
                        this._transport.send(null);
                    }
                },this), 0);
            },            
            
            /**
             * Called when XHR readyState 4 occurs. Processes the response,
             * then reopens the connection to the server unless close()
             * has been called.
             * @method _validateResponse
             * @return {void}
             * @private
             */
            _validateResponse: function(){
                var src = this._transport;
                if (src.status >= 200 && src.status < 300){
                    this._processIncomingData(src.responseText);
                    
                    //readyState will be 2 if close() was called
                    if (this.readyState != 2){
                    
                        //cleanup event handler to prevent memory leaks in IE
                        this._transport.onreadystatechange = function(){};
                        
                        //now start it
                        this._init();
                    }
                } else {
                    this.readyState = 2;
                    this.fire({type:"error"});
                }
                
                //prevent memory leaks due to closure
                src = null;
            },
            
            /**
             * Updates the readyState property to 1 if it's still
             * set at 0 and fires the open event.
             * @method _signalOpen
             * @return {void}
             * @private
             */
            _signalOpen: function(){
                if (this.readyState == 0){
                    this.readyState = 1;
                    this.fire({type:"open"});
                }
            },
            
            /**
             * Processes the data stream as server-sent events. Goes line by
             * line looking for event information and fires the message
             * event where appropriate.
             * @param {String} text The text to parse.
             * @return {void}
             * @private
             * @method _processIncomingData
             */
            _processIncomingData: function(text){
                text = text.substring(this._lastIndex);                
                this._lastIndex += text.length;
                
                var lines = text.split("\n"),
                    parts,
                    i = 0,
                    len = lines.length,
                    data = "",
                    eventName = "";
                    
                while (i < len){
                    
                    if (lines[i].indexOf(":") > -1){
                    
                        parts = lines[i].split(":");
                        
                        //shift off the first item to check the value
                        //keep in mind that "data: a:b" is a valid value
                        switch(parts.shift()){
                            case "data":
                                data += parts.join(":") + "\n";
                                break;
                                
                            case "event":
                                eventName = parts[1];
                                break;
                                
                            case "id":
                                //todo
                                break;
                        }
                    
                    } else if (lines[i].replace(/\s/g, "") == ""){
                        //an empty line means to flush the event buffer of data
                        //but only if there's data to send
                    
                        if (data != ""){
                        
                            //per spec, strip off last newline
                            if (data.charAt(data.length-1) == "\n"){
                                data = data.substring(0,data.length-1);
                            }
                        
                            //an empty line means a message is complete
                            this.fire({type: "message", data: data});
                            
                            //clear the existing data
                            data = "";
                            eventName = "";
                        }
                    
                    }
                
                    i++;
                }
                
            },
            
            /**
             * Permanently close the connection with the server.
             * @method close
             * @return {void}
             */
            close: function(){
                if (this.readyState != 2){
                    this.readyState = 2;
                    this._transport.abort();
                }
            }

        };
    
    
    
    }
    
    //inherit from Event.Target to get events, and assign instance methods
    Y.extend(YUIEventSource, Y.Event.Target, YUIEventSourceProto);

    //publish to Y object
    Y.EventSource = YUIEventSource;
YUI.add("gallery-eventsource",function(E){var A=typeof EventSource!="undefined",B,D;function C(F){E.Event.Target.call(this);this.url=F;this.readyState=0;this._transport=null;this._init();}D={_fireErrorEvent:function(){E.later(0,this,function(){this.readyState=2;this.fire({type:"error"});});},_fireOpenEvent:function(){E.later(0,this,function(){this.readyState=1;this.fire({type:"open"});});},_fireMessageEvent:function(F){E.later(0,this,function(){this.fire(F);});}};if(A){B={_init:function(){try{var H=new EventSource(this.url),G=this;H.onopen=H.onmessage=H.onerror=E.bind(function(I){switch(I.type){case"open":this._fireOpenEvent();break;case"message":this._fireMessageEvent({type:"message",data:I.data,lastEventId:I.lastEventId,origin:I.origin});break;case"error":this._fireErrorEvent();break;}},this);this._transport=H;}catch(F){this._fireErrorEvent();}},close:function(){if(this._transport!=null){this._transport.close();}this.readyState=2;},on:function(J,I,H,G,F){var K=this;if(J!="message"&&J!="error"&&J!="open"){this._transport.addEventListener(J,function(L){K._fireMessageEvent({type:L.type,data:L.data,origin:L.origin,lastEventId:L.lastEventId});},false);}E.Event.Target.prototype.on.apply(this,arguments);}};}else{B={_init:function(){this._lastIndex=0;this._lastEventId=null;this._data="";this._eventName="";var G,F=this;if(this.readyState!=2){if(typeof XMLHttpRequest!="undefined"){G=new XMLHttpRequest();}else{if(typeof ActiveXObject!="undefined"){G=new ActiveXObject("MSXML2.XMLHttp");}else{throw new Error("Server-sent events unavailable.");}}G.open("get",this.url,true);G.onreadystatechange=function(){if(G.readyState==3){if(G.getResponseHeader("Content-type")!="text/event-stream"){F.close();F._fireErrorEvent();return;}F._signalOpen();if(E.UA.ie===0&&E.UA.ie<8){F._processIncomingData(G.responseText);}}else{if(G.readyState==4&&F.readyState<2){F._signalOpen();F._fireMessageEvent();F._validateResponse();}}};this._transport=G;G.send(null);}},_validateResponse:function(){var G=this._transport;try{if(G.status>=200&&G.status<300){this._processIncomingData(G.responseText);if(this.readyState!=2){this._transport.onreadystatechange=function(){};this._init();}}else{throw new Error();}}catch(F){this._fireErrorEvent();}G=null;},_signalOpen:function(){if(this.readyState==0){this._fireOpenEvent();}},_processDataLine:function(F,H,G){var I;switch(F){case"data":I=H+"\n";if(I.charAt(0)==" "){I=I.substring(1);}this._data+=I;break;case"event":this._eventName=H.replace(/^\s+|\s+$/g,"");break;case"":break;case"id":this._lastEventId=H;break;case"retry":break;default:if(!G){this._processDataLine(F,"",true);}}},_processIncomingData:function(K){K=K.substring(this._lastIndex);this._lastIndex+=K.length;var G=K.split("\n"),J,H=0,F=G.length,I;while(H<F){if(G[H].indexOf(":")>-1){J=G[H].split(":");this._processDataLine(J.shift(),J.join(":"));}else{if(G[H].replace(/\s/g,"")==""){this._fireMessageEvent();}}H++;}},_fireMessageEvent:function(){var G="message",H,F;if(this._data!=""){if(this._data.charAt(this._data.length-1)=="\n"){this._data=this._data.substring(0,this._data.length-1);}if(this._eventName.replace(/^\s+|\s+$/g,"")!=""){G=this._eventName;}H=this._data;F=this._lastEventId;E.later(0,this,function(){this.fire({type:G,data:H,lastEventId:F});});this._data="";this._eventName="";}},close:function(){if(this.readyState!=2){this.readyState=2;if(this._transport){this._transport.abort();}}}};}E.extend(C,E.Event.Target,E.merge(D,B));E.EventSource=C;},"@VERSION@",{requires:["event-base","event-custom"]});
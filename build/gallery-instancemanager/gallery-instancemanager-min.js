YUI.add("gallery-instancemanager",function(Y){function InstanceManager(){this._map={};this._constructors={};}InstanceManager.prototype={get:function(id){if(this._map[id]===null&&this._constructors[id]){var c=this._constructors[id];var s="new "+(Y.Lang.isFunction(c.fn)?"c.fn":c.fn)+"(";if(c.args&&c.args.length){for(var i=0;i<c.args.length;i++){if(i>0){s+=",";}s+="c.args["+i+"]";}}s+=")";this._map[id]=eval(s);}return this._map[id]||false;},getIfConstructed:function(id){return this._map[id]||false;},put:function(id,objOrCtor,args){if(this._map[id]){return false;}else{if(Y.Lang.isFunction(objOrCtor)||Y.Lang.isString(objOrCtor)){this._constructors[id]={fn:objOrCtor,args:Y.Lang.isArray(args)?args:[args]};this._map[id]=null;return true;}else{this._map[id]=objOrCtor;return true;}}},remove:function(id){if(this._map[id]){var obj=this._map[id];delete this._map[id];return obj;}else{return false;}},clear:function(){this._map={};},applyToAll:function(behavior,args,skip_unconstructed){var map=this._map,isFunction=Y.Lang.isFunction(behavior),isObject=Y.Lang.isObject(behavior);for(var name in map){if(map.hasOwnProperty(name)){var item=map[name];if(!item&&skip_unconstructed){continue;}else{if(!item){item=this.get(name);}}if(isFunction||isObject){var fn=isFunction?behavior:behavior.fn,scope=isFunction?window:behavior.scope;fn.apply(scope,[{key:name,value:item}].concat(args));}else{if(item&&Y.Lang.isFunction(item[behavior])){item[behavior].apply(item,args);}}}}}};Y.InstanceManager=InstanceManager;},"gallery-2010.03.18-19");
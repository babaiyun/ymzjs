/*! ymzBase v1.0.0 */
(function(global){
'use strict';

if(global.ymzBase) return;

var doc =typeof global.document !== 'undefined' ? global.document : null,
toString =Object.prototype.toString,
hasOwnProperty =Object.prototype.hasOwnProperty,
funcToString =Function.prototype.toString,
objectCtorString =funcToString.call(Object),
objectCreate =Object.create,
objectGetPrototypeOf =Object.getPrototypeOf,
arrayIsArray =Array.isArray,
slice =Array.prototype.slice,
nativeTrim =String.prototype.trim,
dateNow =Date.now,
__uid =0,
configData ={styleNonce:''},
htmlEscapeMap ={
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	"'": '&#39;',
	'"': '&quot;'
};

function noop(){}

function ret(v){ return v; }

function now(){
	return dateNow ? dateNow() : +new Date();
}

var nativeRequestFrame =typeof global.requestAnimationFrame === 'function' ? global.requestAnimationFrame : null,
nativeCancelFrame =typeof global.cancelAnimationFrame === 'function' ? global.cancelAnimationFrame : null,
requestFrame =nativeRequestFrame ? function(func){
	return nativeRequestFrame.call(global, func);
} : function(func){
	return global.setTimeout(function(){ func(now()); }, 16);
},
cancelFrame =nativeCancelFrame ? function(id){
	nativeCancelFrame.call(global, id);
} : function(id){
	global.clearTimeout(id);
};

function hasOwn(obj, key){
	return obj != null && hasOwnProperty.call(obj, key);
}

function newMap(){
	return objectCreate ? objectCreate(null) : {};
}

function extend(target){
	target =target || {};

	for(var i=1; i<arguments.length; i++){
		var source =arguments[i];
		if(source == null) continue;

		for(var name in source){
			if(name !== '__proto__' && hasOwn(source, name)) target[name] =source[name];
		}
	}
	return target;
}

function type(value){
	if(value == null) return String(value);
	return toString.call(value).slice(8, -1).toLowerCase();
}

function isArray(value){
	return arrayIsArray ? arrayIsArray(value) : toString.call(value) === '[object Array]';
}

function isFunction(value){
	return typeof value === 'function';
}

function isString(value){
	return typeof value === 'string';
}

function isNumber(value){
	return typeof value === 'number' && isFinite(value);
}

function isObject(value){
	return value !== null && typeof value === 'object';
}

function isPlainObject(value){
	if(toString.call(value) !== '[object Object]') return false;

	var proto =objectGetPrototypeOf ? objectGetPrototypeOf(value) : value.__proto__;
	if(proto == null) return true;

	var ctor =hasOwn(proto, 'constructor') && proto.constructor;
	return typeof ctor === 'function' && funcToString.call(ctor) === objectCtorString;
}

function isArrayLike(value){
	if(!value || typeof value === 'string' || typeof value === 'function' || value === global) return false;

	var len =value.length;
	return typeof len === 'number' && isFinite(len) && len >= 0 && len % 1 === 0 && len <= 9007199254740991;
}

function isDef(value){
	return value !== undefined && value !== null;
}

function toArray(value){
	if(value == null) return [];
	if(isArray(value)) return value.slice();
	if(isArrayLike(value)) return slice.call(value);
	return [value];
}

function each(value, callback){
	if(typeof callback !== 'function') throw new TypeError('each callback must be a function');
	if(value == null) return value;

	var i, len, name;

	if(isArrayLike(value)){
		for(i=0, len=value.length; i<len; i++){
			if(callback.call(value[i], value[i], i, value) === false) break;
		}
	}else{
		for(name in value){
			if(hasOwn(value, name) && callback.call(value[name], value[name], name, value) === false) break;
		}
	}

	return value;
}

function isEmpty(value){
	if(value == null || value === '') return true;
	if(isArray(value) || typeof value === 'string' || isArrayLike(value)) return value.length === 0;

	var valueType =type(value);
	if((valueType === 'map' || valueType === 'set') && typeof value.size === 'number') return value.size === 0;

	if(isPlainObject(value)){
		for(var name in value){
			if(hasOwn(value, name)) return false;
		}
		return true;
	}

	return false;
}

/**
 * 浅复制常用基础数据类型
 */
function clone(value){
	if(isArray(value)) return value.slice();

	if(isPlainObject(value)){
		var result =objectGetPrototypeOf && objectGetPrototypeOf(value) === null && objectCreate ? objectCreate(null) : {};
		return extend(result, value);
	}

	var valueType =type(value);
	if(valueType === 'date') return new Date(value.getTime());

	if(valueType === 'regexp'){
		var flags =value.flags;

		if(typeof flags !== 'string'){
			flags ='';
			if(value.global) flags +='g';
			if(value.ignoreCase) flags +='i';
			if(value.multiline) flags +='m';
			if(value.unicode) flags +='u';
			if(value.sticky) flags +='y';
			if(value.dotAll) flags +='s';
			if(value.hasIndices) flags +='d';
		}

		var reg =new RegExp(value.source, flags);
		reg.lastIndex =value.lastIndex;
		return reg;
	}

	return value;
}

function trim(value){
	value =String(value == null ? '' : value);
	return nativeTrim ? nativeTrim.call(value) : value.replace(/^\s+|\s+$/g, '');
}

function strLower(value){
	return value == null ? '' : String(value).toLowerCase();
}

function strUpper(value){
	return value == null ? '' : String(value).toUpperCase();
}

/**
 * 获取查询根节点
 */
function getRoot(root){
	if(!doc) return null;
	if(root == null) return doc;
	if(typeof root === 'string') return doc.querySelector(root);
	return root;
}

function queryElem(elem, root){
	if(typeof elem !== 'string') return elem || null;
	var base =getRoot(root);
	return base ? base.querySelector(elem) : null;
}

function queryAll(selector, root){
	var base =getRoot(root);
	return base ? slice.call(base.querySelectorAll(selector)) : [];
}

function createElem(tag, claName){
	if(!doc) return null;
	var elem =doc.createElement(tag);
	if(claName) elem.className =claName;
	return elem;
}

function getId(id){
	if(!doc) return null;
	return typeof id === 'string' ? doc.getElementById(id) : id;
}

function dataset(elem, name, defVal){
	if(!elem || !elem.dataset) return defVal === undefined ? null : defVal;
	var val =elem.dataset[name];
	return val === undefined ? (defVal === undefined ? null : defVal) : val;
}

function datasets(elem, names){
	var result ={};
	for(var i=0, len=names.length; i<len; i++) result[names[i]] =dataset(elem, names[i]);
	return result;
}

function closest(elem, selector){
	return elem && elem.closest ? elem.closest(selector) : null;
}

function eventClosest(event, selector, root){
	var elem =closest(event && event.target, selector);
	if(!elem) return null;
	if(!root) return elem;

	root =queryElem(root);
	if(!root) return null;

	return elem === root || root.contains(elem) ? elem : null;
}

function matches(elem, selector){
	return !!(elem && elem.matches && elem.matches(selector));
}

function escapeRegExp(value){
	return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(value){
	return String(value == null ? '' : value).replace(/[&<>'"]/g, function(ch){
		return htmlEscapeMap[ch];
	});
}

function consLog(){
	var cons =global.console || {};
	if(!cons.log) return;

	if(cons.log.apply){
		cons.log.apply(cons, arguments);
	}else{
		cons.log(arguments[0]);
	}
}

function consErr(){
	var cons =global.console || {};
	if(!cons.error) return;

	if(cons.error.apply){
		cons.error.apply(cons, arguments);
	}else{
		cons.error(arguments[0]);
	}
}

/**
 * 异步抛出组件回调中的异常
 * 避免用户回调异常中断组件自身清理流程
 */
function reportError(error){
	if(typeof global.setTimeout === 'function'){
		global.setTimeout(function(){
			throw error;
		}, 0);
		return;
	}

	throw error;
}

/**
 * 安全执行组件对外回调
 */
function safeCall(func, context, args){
	if(typeof func !== 'function') return;

	try{
		return func.apply(context == null ? null : context, args || []);
	}catch(e){
		reportError(e);
	}
}

function debounce(func, wait, immediate){
	if(typeof func !== 'function') throw new TypeError('debounce func must be a function');

	wait =Math.max(0, Number(wait) || 0);

	var timer =null,
	lastArgs,
	lastThis,
	result;

	function later(){
		var args =lastArgs,
		context =lastThis;

		timer =null;
		lastThis =lastArgs =null;

		if(!immediate) result =func.apply(context, args);
	}

	function wrapped(){
		lastThis =this;
		lastArgs =arguments;

		var callNow =!!immediate && timer === null;

		if(timer !== null) global.clearTimeout(timer);
		timer =global.setTimeout(later, wait);

		if(callNow){
			var args =lastArgs,
			context =lastThis;

			lastThis =lastArgs =null;
			result =func.apply(context, args);
		}

		return result;
	}

	wrapped.cancel =function(){
		if(timer !== null) global.clearTimeout(timer);

		timer =null;
		lastThis =lastArgs =null;
	};

	return wrapped;
}

function throttle(func, wait){
	if(typeof func !== 'function') throw new TypeError('throttle func must be a function');

	wait =Math.max(0, Number(wait) || 0);

	var lastTime =0,
	timer =null,
	lastArgs,
	lastThis,
	result;

	function invoke(time){
		var args =lastArgs,
		context =lastThis;

		lastTime =time;
		lastThis =lastArgs =null;
		result =func.apply(context, args);
	}

	function later(){
		timer =null;
		invoke(now());
	}

	function wrapped(){
		var current =now(),
		remain =wait - (current - lastTime);

		lastThis =this;
		lastArgs =arguments;

		if(remain <= 0 || remain > wait){
			if(timer !== null){
				global.clearTimeout(timer);
				timer =null;
			}

			invoke(current);

		}else if(timer === null){
			timer =global.setTimeout(later, remain);
		}

		return result;
	}

	wrapped.cancel =function(){
		if(timer !== null) global.clearTimeout(timer);

		timer =null;
		lastTime =0;
		lastThis =lastArgs =null;
	};

	return wrapped;
}

function uniqueId(prefix){
	__uid++;
	return (prefix == null ? 'ymz_' : String(prefix)) + __uid;
}

function intval(value, defVal){
	defVal =defVal === undefined ? 0 : defVal;
	if(value === null || value === undefined || value === '') return defVal;

	var num =parseInt(value, 10);
	return isNaN(num) ? defVal : num;
}

function floatval(value, defVal){
	defVal =defVal === undefined ? 0 : defVal;
	if(value === null || value === undefined || value === '') return defVal;

	var num =parseFloat(value);
	return isNaN(num) ? defVal : num;
}

function arrIndex(value, arr){
	for(var i=0, len=arr.length; i<len; i++){
		if(value === arr[i]) return i;
	}

	return -1;
}

function inArr(value, arr){
	return arrIndex(value, arr) !== -1;
}

function arrDelVal(value, arr){
	var result =[];

	for(var i=0, len=arr.length; i<len; i++){
		if(value !== arr[i]) result.push(arr[i]);
	}

	return result;
}

function injectStyle(id, css){
    if(!doc || !id || !css) return null;

    var oT =getId(id);
    if(oT) return oT;

    oT =createElem('style');
    oT.id =id;
    oT.type ='text/css';

    if(configData.styleNonce){
        oT.setAttribute('nonce', configData.styleNonce);
    }

    oT.textContent =String(css);
    (doc.head || doc.documentElement).appendChild(oT);

    return oT;
}

function jsonEncode(value){
	return JSON.stringify(value);
}

function jsonEncodeSafe(value){
	var stack =[];

	return JSON.stringify(value, function(key, val){
		var raw =this[key];

		if(typeof raw === 'undefined') return null;
		if(typeof raw === 'function') return '[Function]';
		if(typeof raw === 'bigint') return raw.toString();

		if(raw instanceof Date){
			return isNaN(raw.getTime()) ? '[Invalid Date]' : raw.toISOString();
		}

		if(val && typeof val === 'object'){
			while(stack.length && stack[stack.length - 1] !== this) stack.pop();

			if(arrIndex(val, stack) !== -1) return '[Circular]';

			stack.push(val);
		}

		return val;
	});
}

function jsonDecode(json){
	return JSON.parse(json);
}

if(isPlainObject(global.ymzBaseConfigData)){
	extend(configData, global.ymzBaseConfigData);
}

global.ymzBase ={
	config: function(opts){
		if(isPlainObject(opts)) extend(configData, opts);
		return configData;
	},

	getDoc: function(){
		return doc;
	},

	noop: noop,
	ret: ret,
	now: now,
	requestFrame: requestFrame,
	cancelFrame: cancelFrame,

	consLog: consLog,
	consErr: consErr,
	reportError: reportError,
	safeCall: safeCall,

	hasOwn: hasOwn,
	extend: extend,

	type: type,
	isArray: isArray,
	isArrayLike: isArrayLike,
	isFunction: isFunction,
	isString: isString,
	isNumber: isNumber,
	isObject: isObject,
	isPlainObject: isPlainObject,
	isEmpty: isEmpty,

	toArray: toArray,
	each: each,
	clone: clone,
	trim: trim,
	strLower: strLower,
	strUpper: strUpper,

	getId: getId,
	queryElem: queryElem,
	queryAll: queryAll,
	createElem: createElem,
    injectStyle: injectStyle,

	dataset: dataset,
	datasets: datasets,
	closest: closest,
	eventClosest: eventClosest,
	matches: matches,

	newMap: newMap,
	escapeRegExp: escapeRegExp,
	escapeHtml: escapeHtml,
	uniqueId: uniqueId,

	debounce: debounce,
	throttle: throttle,

	isDef: isDef,
	intval: intval,
	floatval: floatval,
	arrIndex: arrIndex,
	inArr: inArr,
	arrDelVal: arrDelVal,

	jsonEncode: jsonEncode,
	jsonEncodeSafe: jsonEncodeSafe,
	jsonDecode: jsonDecode
};

}(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this)));
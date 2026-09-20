/*! ymzAjax v1.14.0 */
(function(global){
'use strict';

if(global.ymzAjax) return;

var base =global.ymzBase;
if(!base) throw new Error('ymzBase is required');

var defaults ={
	baseUrl:'',
	timeout:15000,
	dataType:'json',
	withCredentials:false,
	cache:true,
	headers:base.newMap()
},
hasOwn =base.hasOwn,
extend =base.extend,
isPlainObject =base.isPlainObject,
newMap =base.newMap;

function reportError(error){
	if(typeof base.reportError === 'function'){
		base.reportError(error);
		return;
	}

	global.setTimeout(function(){
		throw error;
	}, 0);
}

function callFunc(func, args){
	if(typeof func !== 'function') return;

	try{
		return func.apply(null, args || []);
	}catch(e){
		reportError(e);
	}
}

function checkFunc(func, name){
	if(func != null && typeof func !== 'function'){
		throw new TypeError('ajax ' + name + ' must be a function');
	}
}

function isFormData(value){
	return typeof global.FormData !== 'undefined' && value instanceof global.FormData;
}

function isUrlSearchParams(value){
	return typeof global.URLSearchParams !== 'undefined' && value instanceof global.URLSearchParams;
}

function isRawBody(value){
	if(value == null) return false;
	if(typeof global.Blob !== 'undefined' && value instanceof global.Blob) return true;
	if(typeof global.ArrayBuffer !== 'undefined' && value instanceof global.ArrayBuffer) return true;

	return typeof global.ArrayBuffer !== 'undefined'
		&& global.ArrayBuffer.isView
		&& global.ArrayBuffer.isView(value);
}

function encode(value){
	return encodeURIComponent(value == null ? '' : String(value));
}

function buildQuery(value, prefix, list, stack){
	if(value == null){
		list.push(encode(prefix) + '=');
		return;
	}

	var isArray =Array.isArray(value),
	isObject =isPlainObject(value);

	if(isArray || isObject){
		for(var s=0; s<stack.length; s++){
			if(stack[s] === value){
				throw new TypeError('ajax data cannot contain circular references');
			}
		}

		stack.push(value);

		if(isArray){
			for(var i=0; i<value.length; i++){
				buildQuery(value[i], prefix + '[]', list, stack);
			}
		}else{
			for(var name in value){
				if(hasOwn(value, name)){
					buildQuery(
						value[name],
						prefix ? prefix + '[' + name + ']' : name,
						list,
						stack
					);
				}
			}
		}

		stack.pop();
		return;
	}

	list.push(encode(prefix) + '=' + encode(value));
}

/**
 * 友好的参数序列化：
 * tags:[1,2] => tags%5B%5D=1&tags%5B%5D=2
 * user:{name:'Ken'} => user%5Bname%5D=Ken
 */
function serialize(data){
	if(data == null) return '';
	if(typeof data === 'string') return data;
	if(isUrlSearchParams(data)) return data.toString();

	if(!isPlainObject(data)){
		throw new TypeError('ajax data must be a plain object, string or URLSearchParams');
	}

	var list =[],
	stack =[data];

	for(var name in data){
		if(hasOwn(data, name)){
			buildQuery(data[name], name, list, stack);
		}
	}

	return list.join('&');
}

function appendQuery(url, query){
	if(!query) return url;

	var hash ='',
	pos =url.indexOf('#');

	if(pos !== -1){
		hash =url.slice(pos);
		url =url.slice(0, pos);
	}

	url +=(url.indexOf('?') === -1 ? '?' : '&') + query;
	return url + hash;
}

function buildUrl(url){
	url =String(url == null ? '' : url);

	if(/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(url) || url.charAt(0) === '/'){
		return url;
	}

	var baseUrl =String(defaults.baseUrl || '');

	if(baseUrl && url && baseUrl.charAt(baseUrl.length - 1) !== '/'){
		baseUrl +='/';
	}

	return baseUrl + url;
}

function cloneHeaders(source){
	var result =newMap();
	if(source == null) return result;

	for(var name in source){
		if(hasOwn(source, name)) result[name] =source[name];
	}

	return result;
}

function findHeaderKey(headers, name){
	name =String(name).toLowerCase();

	for(var key in headers){
		if(hasOwn(headers, key) && key.toLowerCase() === name){
			return key;
		}
	}

	return null;
}

function hasHeader(headers, name){
	return findHeaderKey(headers, name) !== null;
}

function deleteHeader(headers, name){
	var key =findHeaderKey(headers, name);
	if(key !== null) delete headers[key];
}

function setHeader(headers, name, value){
	var oldKey =findHeaderKey(headers, name);
	if(oldKey !== null) delete headers[oldKey];

	if(value != null){
		headers[String(name)] =value;
	}
}

/**
 * Header名称大小写不敏感，后传入的同名Header覆盖前值。
 * 值为null/undefined时删除该Header。
 */
function mergeHeaders(target, source){
	var result =cloneHeaders(target);
	if(source == null) return result;

	if(!isPlainObject(source)){
		throw new TypeError('ajax headers must be a plain object');
	}

	for(var name in source){
		if(hasOwn(source, name)){
			setHeader(result, name, source[name]);
		}
	}

	return result;
}

function applyContentType(headers, option, defaultType){
	if(option.contentType === false){
		deleteHeader(headers, 'Content-Type');
		return;
	}

	if(hasHeader(headers, 'Content-Type')) return;

	if(option.contentType != null && option.contentType !== ''){
		headers['Content-Type'] =String(option.contentType);
		return;
	}

	if(defaultType){
		headers['Content-Type'] =defaultType;
	}
}

function makeError(message, type, xhr, url, response, originalError){
	var error =new Error(message);

	error.type =type;
	error.status =xhr ? xhr.status : 0;
	error.statusText =xhr ? xhr.statusText : '';
	error.response =response;
	error.xhr =xhr || null;
	error.url =url;

	if(originalError){
		error.originalError =originalError;
	}

	return error;
}

function parseResponse(xhr, dataType, strict){
	if(dataType === 'text' || dataType == null || dataType === ''){
		return xhr.responseText;
	}

	if(dataType === 'json'){
		var text =xhr.responseText;
		if(text == null || text === '') return null;

		try{
			return JSON.parse(text);
		}catch(e){
			if(strict) throw e;
			return text;
		}
	}

	return xhr.response;
}

function request(option){
	option =option || {};

	if(!isPlainObject(option)){
		return Promise.reject(new TypeError('ajax option must be a plain object'));
	}

	var rawUrl =option.url == null ? '' : String(option.url);
	if(base.trim(rawUrl) === ''){
		return Promise.reject(new TypeError('ajax url cannot be empty'));
	}

	if(typeof global.XMLHttpRequest === 'undefined'){
		return Promise.reject(new Error('XMLHttpRequest is not supported'));
	}

	try{
		checkFunc(option.success, 'success');
		checkFunc(option.error, 'error');
		checkFunc(option.complete, 'complete');
	}catch(e){
		return Promise.reject(e);
	}

	var method =base.trim(String(option.method == null ? 'GET' : option.method)).toUpperCase();
	if(method === ''){
		return Promise.reject(new TypeError('ajax method cannot be empty'));
	}

	var dataType =option.dataType == null
		? defaults.dataType
		: base.trim(String(option.dataType)).toLowerCase(),
	timeout =option.timeout == null ? defaults.timeout : Number(option.timeout),
	withCredentials =option.withCredentials == null ? defaults.withCredentials : !!option.withCredentials,
	cache =option.cache == null ? defaults.cache : !!option.cache,
	data =option.data,
	url =buildUrl(rawUrl),
	body =null,
	headers,
	xhr;

	if(!isFinite(timeout) || timeout < 0){
		return Promise.reject(new TypeError('ajax timeout must be a non-negative number'));
	}

	try{
		headers =mergeHeaders(defaults.headers, option.headers);

		if(method === 'GET' || method === 'HEAD'){
			if(data != null){
				url =appendQuery(url, serialize(data));
			}

			if(!cache){
				url =appendQuery(url, '_=' + base.now());
			}

			if(option.contentType === false){
				deleteHeader(headers, 'Content-Type');
			}

		}else if(data != null){
			if(isFormData(data)){
				body =data;

				// multipart boundary 必须由浏览器生成
				deleteHeader(headers, 'Content-Type');

			}else if(option.json === true){
				body =JSON.stringify(data);

				if(typeof body === 'undefined'){
					throw new TypeError('ajax json data cannot be serialized');
				}

				applyContentType(
					headers,
					option,
					'application/json;charset=UTF-8'
				);

			}else if(isRawBody(data)){
				body =data;
				applyContentType(headers, option, null);

			}else if(typeof data === 'string' || isUrlSearchParams(data)){
				body =isUrlSearchParams(data) ? data.toString() : data;

				applyContentType(
					headers,
					option,
					'application/x-www-form-urlencoded;charset=UTF-8'
				);

			}else{
				body =serialize(data);

				applyContentType(
					headers,
					option,
					'application/x-www-form-urlencoded;charset=UTF-8'
				);
			}

		}else if(option.contentType === false){
			deleteHeader(headers, 'Content-Type');
		}

	}catch(e){
		return Promise.reject(e);
	}

	try{
		xhr =new global.XMLHttpRequest();
	}catch(e){
		return Promise.reject(makeError(
			'ajax request create failed: ' + url,
			'request',
			null,
			url,
			null,
			e
		));
	}

	var settled =false,
	job =new Promise(function(resolve, reject){

		function cleanup(){
			xhr.onload =null;
			xhr.onerror =null;
			xhr.ontimeout =null;
			xhr.onabort =null;
		}

		function success(response){
			if(settled) return;
			settled =true;
			cleanup();

			// 用户回调异常不改变已经完成的HTTP请求结果
			callFunc(option.success, [response, xhr]);
			callFunc(option.complete, [xhr, response, null]);
			resolve(response);
		}

		function fail(err){
			if(settled) return;
			settled =true;
			cleanup();

			callFunc(option.error, [err, xhr]);
			callFunc(option.complete, [xhr, err.response, err]);
			reject(err);
		}

		try{
			xhr.open(method, url, true);
			xhr.timeout =timeout > 0 ? timeout : 0;
			xhr.withCredentials =withCredentials;

			if(dataType && dataType !== 'json' && dataType !== 'text'){
				xhr.responseType =dataType;
			}

			for(var name in headers){
				if(hasOwn(headers, name)){
					xhr.setRequestHeader(name, String(headers[name]));
				}
			}
		}catch(e){
			fail(makeError(
				'ajax request init failed: ' + url,
				'request',
				xhr,
				url,
				null,
				e
			));
			return;
		}

		xhr.onload =function(){
			var ok =(xhr.status >= 200 && xhr.status < 300) || xhr.status === 304,
			response;

			if(ok){
				try{
					response =parseResponse(xhr, dataType, true);
				}catch(e){
					fail(makeError(
						'ajax response parse failed: ' + url,
						'parse',
						xhr,
						url,
						xhr.responseText,
						e
					));
					return;
				}

				success(response);
				return;
			}

			try{
				response =parseResponse(xhr, dataType, false);
			}catch(ignore){
				response =null;
			}

			fail(makeError(
				'ajax http error: ' + xhr.status + ' ' + xhr.statusText,
				'http',
				xhr,
				url,
				response
			));
		};

		xhr.onerror =function(){
			fail(makeError(
				'ajax network error: ' + url,
				'network',
				xhr,
				url,
				null
			));
		};

		xhr.ontimeout =function(){
			fail(makeError(
				'ajax timeout: ' + url,
				'timeout',
				xhr,
				url,
				null
			));
		};

		xhr.onabort =function(){
			fail(makeError(
				'ajax aborted: ' + url,
				'abort',
				xhr,
				url,
				null
			));
		};

		try{
			xhr.send(body);
		}catch(e){
			fail(makeError(
				'ajax request send failed: ' + url,
				'request',
				xhr,
				url,
				null,
				e
			));
		}
	});

	job.abort =function(){
		if(settled || xhr.readyState === 0 || xhr.readyState === 4){
			return false;
		}

		try{
			xhr.abort();
			return true;
		}catch(e){
			return false;
		}
	};

	job.xhr =xhr;
	return job;
}

function mergeOption(option, extra){
	if(option != null && !isPlainObject(option)){
		throw new TypeError('ajax option must be a plain object');
	}

	return extend(extend({}, option || {}), extra);
}

var api =global.ymzAjax ={
	config:function(option){
		if(option == null) return api;
		if(!isPlainObject(option)) throw new TypeError('ajax config must be a plain object');

		/*
		 * 先完整校验到 next，全部成功后再一次性提交。
		 * 避免配置中途报错后 defaults 处于半更新状态。
		 */
		var next ={
			baseUrl:defaults.baseUrl,
			timeout:defaults.timeout,
			dataType:defaults.dataType,
			withCredentials:defaults.withCredentials,
			cache:defaults.cache,
			headers:cloneHeaders(defaults.headers)
		};

		if(hasOwn(option, 'baseUrl')){
			if(typeof option.baseUrl !== 'string'){
				throw new TypeError('ajax baseUrl must be a string');
			}

			next.baseUrl =option.baseUrl;
		}

		if(hasOwn(option, 'timeout')){
			var timeout =Number(option.timeout);

			if(!isFinite(timeout) || timeout < 0){
				throw new TypeError('ajax timeout must be a non-negative number');
			}

			next.timeout =timeout;
		}

		if(hasOwn(option, 'dataType')){
			next.dataType =option.dataType == null
				? ''
				: base.trim(String(option.dataType)).toLowerCase();
		}

		if(hasOwn(option, 'withCredentials')){
			next.withCredentials =!!option.withCredentials;
		}

		if(hasOwn(option, 'cache')){
			next.cache =!!option.cache;
		}

		if(hasOwn(option, 'headers')){
			next.headers =mergeHeaders(next.headers, option.headers);
		}

		defaults =next;
		return api;
	},

	serialize:serialize,
	request:request,

	get:function(url, data, option){
		return request(mergeOption(option, {
			url:url,
			method:'GET',
			data:data
		}));
	},

	post:function(url, data, option){
		return request(mergeOption(option, {
			url:url,
			method:'POST',
			data:data
		}));
	},

	postJson:function(url, data, option){
		return request(mergeOption(option, {
			url:url,
			method:'POST',
			data:data,
			json:true
		}));
	},

	/**
	 * 并行执行多个Promise/Ajax。
	 * succFunc返回Promise时，runAll继续等待该Promise完成。
	 */
	runAll:function(ajaxList, succFunc, errFunc){
		if(!Array.isArray(ajaxList)){
			return Promise.reject(new TypeError('ajaxList must be an array'));
		}

		if(succFunc != null && typeof succFunc !== 'function'){
			return Promise.reject(new TypeError('succFunc must be a function'));
		}

		if(errFunc != null && typeof errFunc !== 'function'){
			return Promise.reject(new TypeError('errFunc must be a function'));
		}

		return Promise.all(ajaxList).then(function(result){
			return succFunc ? succFunc(result) : result;
		}, function(error){
			if(errFunc) callFunc(errFunc, [error]);
			throw error;
		});
	}
};

}(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this)));

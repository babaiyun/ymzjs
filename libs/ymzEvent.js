/*! ymzEvent v1.1.0 */
(function(global){
'use strict';

if(global.ymzEvent) return;

var base =global.ymzBase;
if(!base) throw new Error('ymzBase is required');

var doc =base.getDoc(),
weakStore =typeof global.WeakMap !== 'undefined' ? new global.WeakMap() : null,
fallbackStore =base.newMap(),
nodeSeq =0,
bindSeq =0,
hasOwn =base.hasOwn,
resolveWrap =base.queryElem,
newMap =base.newMap,
reportError =base.reportError || function(error){
	global.setTimeout(function(){ throw error; }, 0);
};

function normalizeType(type){
	if(typeof type !== 'string') throw new TypeError('event type must be a non-empty string');

	type =base.trim(type);
	if(type === '' || /\s/.test(type)){
		throw new TypeError('event type must be a single non-empty string');
	}

	return type;
}

function normalizeSelector(selector){
	if(selector == null) return null;
	if(typeof selector !== 'string') throw new TypeError('event selector must be a string');

	selector =base.trim(selector);
	if(selector === '') throw new TypeError('event selector cannot be empty');

	// 提前检查 selector，避免事件触发后才抛 SyntaxError
	if(doc){
		try{
			doc.querySelector(selector);
		}catch(e){
			throw new TypeError('invalid event selector: ' + selector);
		}
	}

	return selector;
}

function resolveEventTarget(wrap, required){
	var elem =resolveWrap(wrap);

	if(!elem){
		if(required) throw new Error('event wrap not found');
		return null;
	}

	if(typeof elem.addEventListener !== 'function' || typeof elem.removeEventListener !== 'function'){
		if(required) throw new TypeError('event wrap must support addEventListener/removeEventListener');
		return null;
	}

	return elem;
}

function getFallbackId(elem, create){
	var id =elem.__ymzEventId;

	if(!id && create){
		id ='ymz_event_' + (++nodeSeq);

		try{
			Object.defineProperty(elem, '__ymzEventId', {
				value:id,
				configurable:true
			});
		}catch(e){
			elem.__ymzEventId =id;
		}
	}

	return id;
}

function getStore(elem, create){
	if(weakStore){
		var store =weakStore.get(elem);

		if(!store && create){
			store ={buckets:newMap(),total:0};
			weakStore.set(elem, store);
		}

		return store;
	}

	var id =getFallbackId(elem, create);
	if(!id) return null;

	var store =fallbackStore[id];

	if(!store && create){
		store ={buckets:newMap(),total:0};
		fallbackStore[id] =store;
	}

	return store;
}

function deleteStore(elem){
	if(weakStore){
		weakStore.delete(elem);
		return;
	}

	var id =elem.__ymzEventId;
	if(!id) return;

	delete fallbackStore[id];

	try{
		delete elem.__ymzEventId;
	}catch(e){}
}

function getBucketKey(type, capture){
	return type + '|' + (capture ? '1' : '0');
}

function matchSelector(elem, selector){
	var matches =elem && (elem.matches || elem.msMatchesSelector || elem.webkitMatchesSelector);
	return matches ? matches.call(elem, selector) : false;
}

function findTarget(start, selector, wrap){
	if(selector == null) return wrap;

	var elem =start;
	if(elem && elem.nodeType !== 1) elem =elem.parentElement || elem.parentNode;

	// 正常原生事件 target 必定位于 wrap 内，这里额外守住手工/特殊事件边界
	if(elem && wrap && wrap !== global && typeof wrap.contains === 'function' && !wrap.contains(elem)){
		return null;
	}

	while(elem){
		if(matchSelector(elem, selector)) return elem;
		if(elem === wrap) break;

		elem =elem.parentElement || elem.parentNode;
	}

	return null;
}

function detachBucket(elem, store, bucket){
	elem.removeEventListener(bucket.type, bucket.listener, bucket.capture);
	delete store.buckets[getBucketKey(bucket.type, bucket.capture)];
}

function removeItem(elem, store, bucket, item){
	if(!item.active) return false;

	var index =bucket.items.indexOf(item);
	if(index === -1){
		item.active =false;
		return false;
	}

	item.active =false;
	bucket.items.splice(index, 1);
	store.total--;

	if(bucket.items.length === 0){
		detachBucket(elem, store, bucket);
	}

	if(store.total <= 0){
		deleteStore(elem);
	}

	return true;
}

function createBucket(elem, store, type, capture){
	var key =getBucketKey(type, capture),
	bucket ={
		type:type,
		capture:capture,
		items:[],
		listener:null
	};

	bucket.listener =function(e){
		var runList =bucket.items.slice(),
		isStopped =false,
		origStop =e.stopImmediatePropagation,
		patched =false;

		/*
		 * 一个原生 listener 承载多个逻辑 handler。
		 * 临时代理 stopImmediatePropagation，让它同时停止本 bucket 后续逻辑 handler。
		 */
		if(runList.length > 1 && typeof origStop === 'function'){
			try{
				e.stopImmediatePropagation =function(){
					isStopped =true;
					return origStop.call(e);
				};
				patched =e.stopImmediatePropagation !== origStop;
			}catch(ignore){}
		}

		try{
			for(var i=0, len=runList.length; i<len; i++){
				if(isStopped) break;

				var item =runList[i];
				if(!item.active) continue;

				var target =findTarget(e.target, item.selector, elem);
				if(!target) continue;

				/*
				 * once 必须在回调执行前移除。
				 * 否则回调内部再次 dispatch 同类事件时会重复执行。
				 */
				if(item.once){
					removeItem(elem, store, bucket, item);
				}

				try{
					item.handler.call(target, e, target);
				}catch(error){
					reportError(error);
				}
			}
		}finally{
			if(patched){
				try{
					e.stopImmediatePropagation =origStop;
				}catch(ignore){}
			}
		}
	};

	/*
	 * 原生监听成功后才写入 store。
	 * 避免 addEventListener 抛异常时遗留没有真实 listener 的脏 bucket。
	 */
	elem.addEventListener(type, bucket.listener, capture);
	store.buckets[key] =bucket;

	return bucket;
}

function normalizeOnArgs(selector, handler, option){
	if(typeof selector === 'function'){
		option =handler;
		handler =selector;
		selector =null;
	}

	return {
		selector:selector,
		handler:handler,
		option:option || {}
	};
}

function bindItem(elem, type, selector, handler, option){
	var capture =!!option.capture,
	once =!!option.once,
	store =getStore(elem, true),
	key =getBucketKey(type, capture),
	bucket =store.buckets[key];

	if(!bucket){
		try{
			bucket =createBucket(elem, store, type, capture);
		}catch(e){
			if(store.total <= 0) deleteStore(elem);
			throw e;
		}
	}

	for(var i=0, len=bucket.items.length; i<len; i++){
		var exists =bucket.items[i];

		if(
			exists.selector === selector
			&& exists.handler === handler
			&& exists.once === once
		){
			return {id:exists.id,created:false};
		}
	}

	var item ={
		id:++bindSeq,
		selector:selector,
		handler:handler,
		once:once,
		capture:capture,
		active:true
	};

	bucket.items.push(item);
	store.total++;

	return {id:item.id,created:true};
}

function on(wrap, type, selector, handler, option){
	var elem =resolveEventTarget(wrap, true);
	type =normalizeType(type);

	var args =normalizeOnArgs(selector, handler, option);
	selector =normalizeSelector(args.selector);
	handler =args.handler;
	option =args.option;

	if(typeof handler !== 'function'){
		throw new TypeError('event handler must be a function');
	}

	return bindItem(elem, type, selector, handler, option).id;
}

function once(wrap, type, selector, handler, option){
	if(typeof selector === 'function'){
		option =handler || {};
		handler =selector;
		selector =null;
	}else{
		option =option || {};
	}

	var opt =base.extend({}, option);
	opt.once =true;

	return on(wrap, type, selector, handler, opt);
}

/**
 * 批量绑定
 *
 * types 支持 "click dblclick"
 * bindings 格式：[selector, handler]
 */
function onMany(wrap, types, bindings, option){
	var elem =resolveEventTarget(wrap, true);

	if(typeof types !== 'string' || base.trim(types) === ''){
		throw new TypeError('event types must be a non-empty string');
	}

	if(!base.isArray(bindings) || bindings.length === 0){
		throw new TypeError('event bindings must be a non-empty array');
	}

	var typeList =base.trim(types).split(/\s+/),
	typeMap =newMap(),
	cleanTypes =[],
	cleanBindings =[],
	i,
	type,
	item,
	selector,
	handler;

	// 先完整校验，避免参数问题造成只绑定一部分
	for(i=0; i<typeList.length; i++){
		type =normalizeType(typeList[i]);

		if(!typeMap[type]){
			typeMap[type] =1;
			cleanTypes.push(type);
		}
	}

	for(i=0; i<bindings.length; i++){
		item =bindings[i];

		if(!base.isArray(item) || item.length !== 2){
			throw new TypeError('event binding must be [selector, handler]');
		}

		selector =normalizeSelector(item[0]);
		handler =item[1];

		if(typeof handler !== 'function'){
			throw new TypeError('event handler must be a function');
		}

		cleanBindings.push([selector, handler]);
	}

	option =option || {};

	var ids =[],
	createdIds =[];

	try{
		for(i=0; i<cleanTypes.length; i++){
			for(var j=0; j<cleanBindings.length; j++){
				var bindRet =bindItem(
					elem,
					cleanTypes[i],
					cleanBindings[j][0],
					cleanBindings[j][1],
					option
				);

				ids.push(bindRet.id);

				if(bindRet.created){
					createdIds.push(bindRet.id);
				}
			}
		}
	}catch(e){
		/*
		 * 只回滚本次真正新增的绑定。
		 * 已存在的重复绑定虽然返回相同 id，但不能被错误删除。
		 */
		for(i=0; i<createdIds.length; i++){
			offById(elem, createdIds[i]);
		}

		throw e;
	}

	return ids;
}

function matchItem(item, selectorGiven, selector, handler){
	if(selectorGiven && item.selector !== selector) return false;
	if(handler != null && item.handler !== handler) return false;

	return true;
}

function off(wrap, type, selector, handler){
	var elem =resolveEventTarget(wrap, false);
	if(!elem) return 0;

	var store =getStore(elem, false);
	if(!store) return 0;

	if(type != null && type !== ''){
		type =normalizeType(type);
	}

	if(typeof selector === 'function' && handler == null){
		handler =selector;
		selector =undefined;
	}else if(typeof selector !== 'undefined'){
		selector =normalizeSelector(selector);
	}

	var selectorGiven =typeof selector !== 'undefined',
	removed =0,
	keys =[];

	for(var key in store.buckets){
		if(hasOwn(store.buckets, key)){
			keys.push(key);
		}
	}

	for(var i=0, keyLen=keys.length; i<keyLen; i++){
		var bucket =store.buckets[keys[i]];
		if(!bucket) continue;

		if(type != null && type !== '' && bucket.type !== type){
			continue;
		}

		for(var j=bucket.items.length - 1; j>=0; j--){
			var item =bucket.items[j];

			if(!matchItem(item, selectorGiven, selector, handler)){
				continue;
			}

			item.active =false;
			bucket.items.splice(j, 1);
			store.total--;
			removed++;
		}

		if(bucket.items.length === 0){
			detachBucket(elem, store, bucket);
		}
	}

	if(store.total <= 0){
		deleteStore(elem);
	}

	return removed;
}

function offById(wrap, id){
	var elem =resolveEventTarget(wrap, false);
	if(!elem) return false;

	var store =getStore(elem, false);
	if(!store) return false;

	for(var key in store.buckets){
		if(!hasOwn(store.buckets, key)) continue;

		var bucket =store.buckets[key];

		for(var i=0, len=bucket.items.length; i<len; i++){
			if(bucket.items[i].id === id){
				return removeItem(elem, store, bucket, bucket.items[i]);
			}
		}
	}

	return false;
}

function count(wrap, type, selector, handler){
	var elem =resolveEventTarget(wrap, false);
	if(!elem) return 0;

	var store =getStore(elem, false);
	if(!store) return 0;

	if(type != null && type !== ''){
		type =normalizeType(type);
	}

	if(typeof selector === 'function' && handler == null){
		handler =selector;
		selector =undefined;
	}else if(typeof selector !== 'undefined'){
		selector =normalizeSelector(selector);
	}

	var selectorGiven =typeof selector !== 'undefined',
	total =0;

	for(var key in store.buckets){
		if(!hasOwn(store.buckets, key)) continue;

		var bucket =store.buckets[key];

		if(type != null && type !== '' && bucket.type !== type){
			continue;
		}

		for(var i=0, len=bucket.items.length; i<len; i++){
			if(matchItem(bucket.items[i], selectorGiven, selector, handler)){
				total++;
			}
		}
	}

	return total;
}

function list(wrap){
	var elem =resolveEventTarget(wrap, false);
	if(!elem) return [];

	var store =getStore(elem, false);
	if(!store) return [];

	var result =[];

	for(var key in store.buckets){
		if(!hasOwn(store.buckets, key)) continue;

		var bucket =store.buckets[key];

		for(var i=0, len=bucket.items.length; i<len; i++){
			var item =bucket.items[i];

			result.push({
				id:item.id,
				type:bucket.type,
				selector:item.selector,
				once:item.once,
				capture:bucket.capture
			});
		}
	}

	result.sort(function(a, b){
		return a.id - b.id;
	});

	return result;
}

function stats(wrap){
	var elem =resolveEventTarget(wrap, false);

	if(!elem){
		return {total:0,nativeListeners:0,types:{}};
	}

	var store =getStore(elem, false);

	if(!store){
		return {total:0,nativeListeners:0,types:{}};
	}

	var nativeListeners =0,
	types =newMap();

	for(var key in store.buckets){
		if(!hasOwn(store.buckets, key)) continue;

		var bucket =store.buckets[key];

		nativeListeners++;
		types[bucket.type] =(types[bucket.type] || 0) + bucket.items.length;
	}

	return {
		total:store.total,
		nativeListeners:nativeListeners,
		types:types
	};
}

global.ymzEvent ={
	on:on,
	onMany:onMany,
	once:once,
	off:off,
	offById:offById,

	clear:function(wrap){
		return off(wrap);
	},

	has:function(wrap, type, selector, handler){
		return count(wrap, type, selector, handler) > 0;
	},

	count:count,
	list:list,
	stats:stats
};

}(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this)));

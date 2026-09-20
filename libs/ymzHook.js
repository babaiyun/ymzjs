/*! ymzHook v1.0.0 */
(function(global){
'use strict';

if(global.ymzHook) return;

var base =global.ymzBase;
if(!base) throw new Error('ymzBase is required');

var hookMap =base.newMap(),
hookSeq =0,
safeCall =base.safeCall,
slice =Array.prototype.slice;

function normalizeName(name){
	if(typeof name !== 'string') throw new TypeError('hook name must be a non-empty string');

	name =base.trim(name);
	if(name === '') throw new TypeError('hook name must be a non-empty string');

	return name;
}

function normalizePriority(priority){
	priority =priority == null ? 10 : Number(priority);
	return global.isFinite(priority) ? priority : 10;
}

function getList(name, create){
	var list =hookMap[name];

	if(!list && create){
		list =[];
		hookMap[name] =list;
	}

	return list;
}

function compareItem(a, b){
	return a.priority === b.priority ? a.id - b.id : a.priority - b.priority;
}

/**
 * 按优先级插入，默认同优先级注册时可直接追加，避免每次 add 都整体 sort
 */
function insertItem(list, item){
	var len =list.length;

	if(len === 0 || compareItem(list[len - 1], item) <= 0){
		list.push(item);
		return;
	}

	list.push(item);

	var i =len - 1;
	while(i >= 0 && compareItem(list[i], item) > 0){
		list[i + 1] =list[i];
		i--;
	}

	list[i + 1] =item;
}

function deactivateList(list){
	for(var i=0, len=list.length; i<len; i++){
		list[i].active =false;
	}
}

/**
 * 回调执行期间允许 off/clear 修改当前 hook
 * active 状态用于让本轮快照中的已删除回调立即失效
 */
function removeItem(name, item){
	if(!item.active) return false;

	item.active =false;

	var list =getList(name, false);
	if(!list) return true;

	for(var i=list.length - 1; i>=0; i--){
		if(list[i] === item){
			list.splice(i, 1);
			break;
		}
	}

	if(list.length === 0) delete hookMap[name];
	return true;
}

function add(name, handler, priority, once){
	name =normalizeName(name);
	if(typeof handler !== 'function') throw new TypeError('hook handler must be a function');

	var item ={
		id:++hookSeq,
		handler:handler,
		priority:normalizePriority(priority),
		once:!!once,
		active:true
	};

	insertItem(getList(name, true), item);
	return item.id;
}

function on(name, handler, priority){
	return add(name, handler, priority, false);
}

function once(name, handler, priority){
	return add(name, handler, priority, true);
}

function off(name, handler){
	name =normalizeName(name);

	var list =getList(name, false);
	if(!list) return 0;

	if(handler == null){
		var count =list.length;
		deactivateList(list);
		delete hookMap[name];
		return count;
	}

	var removed =0;

	for(var i=list.length - 1; i>=0; i--){
		if(list[i].id === handler || list[i].handler === handler){
			list[i].active =false;
			list.splice(i, 1);
			removed++;
		}
	}

	if(list.length === 0) delete hookMap[name];
	return removed;
}

function has(name, handler){
	name =normalizeName(name);

	var list =getList(name, false);
	if(!list || list.length === 0) return false;
	if(handler == null) return true;

	for(var i=0, len=list.length; i<len; i++){
		if(list[i].id === handler || list[i].handler === handler) return true;
	}

	return false;
}

function emit(name){
	name =normalizeName(name);

	var list =getList(name, false);
	if(!list || list.length === 0) return 0;

	var args =slice.call(arguments, 1),
	runList =list.slice(),
	count =0;

	for(var i=0, len=runList.length; i<len; i++){
		var item =runList[i];
		if(!item.active) continue;

		// once 必须在执行前移除，避免回调内部递归 emit 时再次触发
		if(item.once) removeItem(name, item);

		safeCall(item.handler, null, args);
		count++;
	}

	return count;
}

function filter(name, value){
	name =normalizeName(name);

	var list =getList(name, false);
	if(!list || list.length === 0) return value;

	var args =slice.call(arguments, 2),
	runList =list.slice();

	for(var i=0, len=runList.length; i<len; i++){
		var item =runList[i];
		if(!item.active) continue;

		if(item.once) removeItem(name, item);

		var callArgs =[value];
		if(args.length) callArgs =callArgs.concat(args);

		var result =safeCall(item.handler, null, callArgs);
		if(typeof result !== 'undefined') value =result;
	}

	return value;
}

function count(name){
	name =normalizeName(name);

	var list =getList(name, false);
	return list ? list.length : 0;
}

function list(name){
	name =normalizeName(name);

	var items =getList(name, false);
	if(!items) return [];

	var result =[];

	for(var i=0, len=items.length; i<len; i++){
		result.push({
			id:items[i].id,
			priority:items[i].priority,
			once:items[i].once
		});
	}

	return result;
}

function clear(name){
	if(name == null || name === ''){
		for(var key in hookMap){
			if(base.hasOwn(hookMap, key)) deactivateList(hookMap[key]);
		}

		hookMap =base.newMap();
		return;
	}

	name =normalizeName(name);

	var list =getList(name, false);
	if(!list) return;

	deactivateList(list);
	delete hookMap[name];
}

global.ymzHook ={
	on:on,
	once:once,
	off:off,
	emit:emit,
	filter:filter,
	has:has,
	count:count,
	list:list,
	clear:clear
};

}(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this)));

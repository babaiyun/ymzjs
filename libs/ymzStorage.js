/*! ymzStorage v1.0.0 */
(function(global){
'use strict';

if(global.ymzStorage) return;

function hasOwn(obj, key){
	return obj != null && Object.prototype.hasOwnProperty.call(obj, key);
}

function newMap(){
	return Object.create ? Object.create(null) : {};
}

var config ={prefix:'ymz:'};

// 内存降级存储引擎（当原生 Storage 被禁用时使用）
function createMemoryStore(){
	var map =newMap();
	var keys =[];
	var store ={
		length: 0,
		getItem: function(k){ 
			return hasOwn(map, k) ? map[k] : null; 
		},
		setItem: function(k, v){
			if(!hasOwn(map, k)) keys.push(k);
			map[k] =String(v);
			store.length =keys.length;
		},
		removeItem: function(k){
			if(hasOwn(map, k)){
				delete map[k];
				var idx =keys.indexOf(k);
				if(idx > -1) keys.splice(idx, 1);
				store.length =keys.length;
			}
		},
		key: function(i){ 
			return keys[i] || null; 
		}
	};
	return store;
}

function getNativeStorage(type){
	try{
		var storage =global[type];
		if(!storage) return null;

		var key ='__ymz_storage_test__';
		storage.setItem(key, '1');
		storage.removeItem(key);
		return storage;
	}catch(e){
		return null;
	}
}

function fullKey(key){
	return config.prefix + String(key);
}

function createApi(type){
	var checked =false,
	nativeStore =null,
	activeStore =null;

	function getStore(){
		if(!checked){
			nativeStore =getNativeStorage(type);
			// 原生不可用时，降级使用内存存储
			activeStore =nativeStore || createMemoryStore();
			checked =true;
		}
		return activeStore;
	}

	return {
		// 返回原生 Storage 是否真正可用（非内存降级）
		available: function(){
			getStore();
			return !!nativeStore;
		},

		set: function(key, value, ttl){
			var store =getStore();
			if(!store) return false;

			var expire =0;
			if(ttl != null && Number(ttl) > 0){
				expire =Date.now() + Number(ttl) * 1000;
			}

			try{
				store.setItem(fullKey(key), JSON.stringify({v:value, e:expire}));
				return true;
			}catch(e){
				return false;
			}
		},

		get: function(key, defaultValue){
			var store =getStore();
			if(!store) return defaultValue;

			var raw;
			try{
				raw =store.getItem(fullKey(key));
			}catch(e){
				return defaultValue;
			}
			if(raw == null) return defaultValue;

			try{
				var payload =JSON.parse(raw);
				if(payload && typeof payload === 'object' && hasOwn(payload, 'v')){
					if(payload.e && payload.e <= Date.now()){
						try{ store.removeItem(fullKey(key)); }catch(e){}
						return defaultValue;
					}
					return payload.v;
				}
			}catch(e){
				return raw;
			}
			return defaultValue;
		},

		has: function(key){
			var marker ={};
			return this.get(key, marker) !== marker;
		},

		remove: function(key){
			var store =getStore();
			if(!store) return false;

			try{
				store.removeItem(fullKey(key));
				return true;
			}catch(e){
				return false;
			}
		},

		keys: function(){
			var store =getStore();
			if(!store) return [];

			var result =[];
			try{
				for(var i=0; i<store.length; i++){
					var key =store.key(i);
					if(key && key.indexOf(config.prefix) === 0){
						result.push(key.slice(config.prefix.length));
					}
				}
			}catch(e){
				return [];
			}
			return result;
		},

		clear: function(){
			var keys =this.keys();
			var count =0;
			for(var i=0; i<keys.length; i++){
				if(this.remove(keys[i])) count++;
			}
			return count;
		}
	};
}

var localApi =createApi('localStorage');
var sessionApi =createApi('sessionStorage');

global.ymzStorage ={
	config: function(option){
		if(!option){
			return config;
		}
		if(option.prefix != null){
			config.prefix =String(option.prefix);
		}
		return this;
	},
	local: localApi,
	session: sessionApi
};

}(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this)));
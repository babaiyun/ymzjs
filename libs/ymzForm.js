/*! ymzForm v1.0.0 */
(function(global){
'use strict';
if(global.ymzForm) return;

var base =global.ymzBase;
if(!base) throw new Error('ymzBase is required');

var hasOwn =base.hasOwn,
extend =base.extend,
isPlainObject =base.isPlainObject;

function getForm(form){
	form =base.queryElem(form);
	if(!form || String(form.tagName).toLowerCase() !== 'form') throw new Error('form element not found');
	return form;
}

function addValue(data, name, value){
	if(hasOwn(data, name)){
		if(!Array.isArray(data[name])) data[name] =[data[name]];
		data[name].push(value);
	}else{
		data[name] =value;
	}
}

function get(form){
	form =getForm(form);
	var data ={},formData =new global.FormData(form);

	formData.forEach(function(value, name){
		addValue(data, name, value);
	});

	return data;
}

function valueContains(value, checkValue){
	if(Array.isArray(value)){
		for(var i=0; i<value.length; i++){
			if(String(value[i]) === String(checkValue)) return true;
		}
		return false;
	}

	return String(value) === String(checkValue);
}

function setField(elem, value){
	var type =String(elem.type || '').toLowerCase(),tag =String(elem.tagName || '').toLowerCase();

	if(type === 'file') return;

	if(type === 'checkbox'){
		elem.checked =typeof value === 'boolean' ? value : valueContains(value, elem.value);
		return;
	}

	if(type === 'radio'){
		elem.checked =valueContains(value, elem.value);
		return;
	}

	if(tag === 'select' && elem.multiple){
		var values =Array.isArray(value) ? value : [value];
		for(var i=0; i<elem.options.length; i++) elem.options[i].selected =valueContains(values, elem.options[i].value);
		return;
	}

	elem.value =value == null ? '' : value;
}

function set(form, data){
	form =getForm(form);
	data =data || {};

	for(var name in data){
		if(!hasOwn(data, name)) continue;

		var fields =form.elements[name];
		if(!fields) continue;

		if(fields.length != null && !fields.tagName){
			for(var i=0; i<fields.length; i++) setField(fields[i], data[name]);
		}else{
			setField(fields, data[name]);
		}
	}

	return form;
}

function clear(form){
	form =getForm(form);
	var elements =form.elements;

	for(var i=0; i<elements.length; i++){
		var elem =elements[i],type =String(elem.type || '').toLowerCase(),tag =String(elem.tagName || '').toLowerCase();

		if(type === 'checkbox' || type === 'radio'){
			elem.checked =false;
		}else if(type !== 'button' && type !== 'submit' && type !== 'reset' && type !== 'file'){
			if(tag === 'select' && elem.multiple){
				for(var j=0; j<elem.options.length; j++) elem.options[j].selected =false;
			}else{
				elem.value ='';
			}
		}
	}

	return form;
}

function hasFile(form){
	var elements =form.elements;

	for(var i=0; i<elements.length; i++){
		var elem =elements[i];
		if(String(elem.type || '').toLowerCase() === 'file' && elem.files && elem.files.length) return true;
	}

	return false;
}

function emitAjaxHook(form, stage, ctx){
	var hook =global.ymzHook;
	if(!hook) return;

	var name ='ymzForm.ajax.' + stage;
	hook.emit(name, ctx);

	var hookName =String(form.getAttribute('data-ajax-hook') || '').trim();
	if(hookName) hook.emit(name + ':' + hookName, ctx);
}

/**
 * Ajax提交表单
 *
 * 默认读取form的action、method和字段数据
 * multipart/form-data或存在文件时自动使用FormData
 */
function ajax(form, option){
	form =getForm(form);

	if(option != null && !base.isPlainObject(option)) return global.Promise.reject(new TypeError('form ajax option must be a plain object'));

	var ajaxLib =global.ymzAjax;
	if(!ajaxLib) return global.Promise.reject(new Error('ymzAjax is required'));

	var opt =base.extend({}, option || {}),
	method =String(opt.method || form.getAttribute('method') || 'GET').trim().toUpperCase(),
	enctype =String(form.getAttribute('enctype') || '').toLowerCase(),
	useFormData =base.hasOwn(opt, 'formData') ? !!opt.formData : enctype === 'multipart/form-data' || hasFile(form);

	if(!opt.url) opt.url =form.getAttribute('action') || global.location.href;
	opt.method =method;

	if(method === 'GET' || method === 'HEAD') useFormData =false;
	if(!base.hasOwn(opt, 'data')) opt.data =useFormData ? new global.FormData(form) : get(form);

	delete opt.formData;

	var ctx ={form:form,option:opt,result:null,error:null};
	emitAjaxHook(form, 'before', ctx);

	return ajaxLib.request(ctx.option).then(function(result){
		ctx.result =result;
		emitAjaxHook(form, 'success', ctx);
		emitAjaxHook(form, 'complete', ctx);
		return result;
	}, function(error){
		ctx.error =error;
		emitAjaxHook(form, 'error', ctx);
		emitAjaxHook(form, 'complete', ctx);
		return global.Promise.reject(error);
	});
}

var ajaxInited =false;
function initAjax(){
	if(ajaxInited) return false;

	var event =global.ymzEvent,doc =base.getDoc();
	if(!doc) return false;
	if(!event) throw new Error('ymzEvent is required');

	event.on(doc, 'submit', 'form[data-ajax]', function(e){
		e.preventDefault();
		ajax(this).catch(function(){});
	});

	ajaxInited =true;
	return true;
}

global.ymzForm ={
	get:get,
	serialize:get,
	set:set,
	fill:set,
	clear:clear,

	reset:function(form){
		form =getForm(form);
		form.reset();
		return form;
	},

	toFormData:function(form){
		return new global.FormData(getForm(form));
	},

	ajax:ajax,
	initAjax: initAjax
};

}(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this)));

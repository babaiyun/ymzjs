/*! ymzCheckGroup v1.0.0 */
(function(global){
'use strict';
if(global.ymzCheckGroup) return;

var event =global.ymzEvent;
if(!event) throw new Error('ymzEvent is required');

function escapeAttr(value){
	return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getAttrs(opt){
	var html ='',dataMaps =opt.data_maps;

	if(opt.class_name) html +=' class="' + escapeAttr(opt.class_name) + '"';
	if(opt.name) html +=' name="' + escapeAttr(opt.name) + '"';
	if(opt.value != null) html +=' value="' + escapeAttr(opt.value) + '"';
	if(opt.id) html +=' id="' + escapeAttr(opt.id) + '"';

	if(dataMaps){
		for(var name in dataMaps){
			if(!Object.prototype.hasOwnProperty.call(dataMaps, name)) continue;
			html +=' data-' + name.replace(/_/g, '-') + '="' + escapeAttr(dataMaps[name]) + '"';
		}
	}

	if(opt.disabled) html +=' disabled';
	return html;
}

function getInput(opt){
	opt =opt || {};
	var html ='<input type="checkbox"' + getAttrs(opt);
	if(opt.checked) html +=' checked';
	return html + '>';
}

function getButton(opt){
	opt =opt || {};
	return '<button type="' + escapeAttr(opt.type || 'button') + '"' + getAttrs(opt) + '>' + escapeAttr(opt.text || '') + '</button>';
}

function create(opt){
	opt =opt || {};

	var wrap =typeof opt.wrap === 'string' ? document.querySelector(opt.wrap) : opt.wrap;
	if(!wrap) throw new Error('ymzCheckGroup wrap not found');

	var itemSelector =opt.itemSelector || 'input.ymz-check-item',
	allSelector =opt.allSelector || 'input.ymz-check-all',
	btnBatchSelector =opt.btnBatchSelector || null,
	btnItemSelector =opt.btnItemSelector || null,
	doActionFunc =typeof opt.doActionFunc === 'function' ? opt.doActionFunc : null,
	itemDataFunc =typeof opt.itemDataFunc === 'function' ? opt.itemDataFunc : null,
	onChange =typeof opt.onChange === 'function' ? opt.onChange : null;

	function getItems(){
		return wrap.querySelectorAll(itemSelector);
	}

	function getChecked(){
		return wrap.querySelectorAll(itemSelector + ':checked');
	}

	function getData(items){
		var dataList =[];
		if(!itemDataFunc) return dataList;
		items.forEach(function(item){ dataList.push(itemDataFunc(item)); });
		return dataList;
	}

	function refresh(){
		var items =getItems(),checked =getChecked(),
		all =wrap.querySelector(allSelector),
		batchBtn =btnBatchSelector ? wrap.querySelector(btnBatchSelector) : null;

		if(all){
			all.checked =items.length > 0 && checked.length === items.length;
			all.indeterminate =checked.length > 0 && checked.length < items.length;
		}

		if(batchBtn) batchBtn.disabled =checked.length === 0;
		if(onChange) onChange(checked.length, items.length, checked);
		return checked.length;
	}

	if(doActionFunc && btnItemSelector && itemDataFunc){
		event.on(wrap, 'click', btnItemSelector, function(e){
			e.preventDefault();
			doActionFunc([itemDataFunc(this)]);
		});
	}

	if(doActionFunc && btnBatchSelector && itemDataFunc){
		event.on(wrap, 'click', btnBatchSelector, function(e){
			e.preventDefault();
			var checked =getChecked();
			if(!checked.length) return;
			doActionFunc(getData(checked));
		});
	}

	event.on(wrap, 'change', allSelector, function(){
		var checked =this.checked;
		getItems().forEach(function(item){ item.checked =checked; });
		refresh();
	});

	event.on(wrap, 'change', itemSelector, function(){
		refresh();
	});

	var api ={
		getItems:getItems,
		getChecked:getChecked,
		getData:function(){ return getData(getChecked()); },
		getValues:function(){ return Array.prototype.map.call(getChecked(), function(item){ return item.value; }); },
		count:function(){ return getChecked().length; },
		clear:function(){
			getItems().forEach(function(item){ item.checked =false; });
			refresh();
		},
		refresh:refresh
	};

	refresh();
	return api;
}

global.ymzCheckGroup ={
	create:create,
	getInput:getInput,
	getButton:getButton
};

}(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this)));

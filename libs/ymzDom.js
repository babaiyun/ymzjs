/*! ymzDom v1.0.0 */
(function(global){
'use strict';

if(global.ymzDom) return;

var base =global.ymzBase;
if(!base) throw new Error('ymzBase is required');

var doc =base.getDoc(),
queryElem =base.queryElem,
all =base.queryAll,
createElem =base.createElem;

function firstTarget(target){
	if(typeof target === 'string') return queryElem(target);
	if(!target) return null;

	if(typeof target.length === 'number' && !target.nodeType && target !== global){
		return target.length ? target[0] : null;
	}

	return target;
}

/**
 * 对单个节点、选择器或节点集合执行操作
 */
function eachTarget(target, func){
	var list;

	if(typeof target === 'string'){
		list =all(target);

	}else if(target && typeof target.length === 'number' && !target.nodeType && target !== global){
		list =base.toArray(target);

	}else{
		list =[target];
	}

	for(var i=0, len=list.length; i<len; i++){
		if(list[i] && func(list[i], i) === false) break;
	}
}

function eachClassName(name, func){
	name =base.trim(name);
	if(!name) return;

	var names =name.split(/\s+/);
	for(var i=0, len=names.length; i<len; i++){
		if(names[i]) func(names[i]);
	}
}

function camelToData(name){
	return 'data-' + String(name).replace(/[A-Z]/g, function(ch){
		return '-' + ch.toLowerCase();
	});
}

function contentMethod(target, value, prop){
	var elem =firstTarget(target);
	if(!elem) return value === undefined ? undefined : null;

	if(value === undefined) return elem[prop];

	var setValue =value == null ? '' : String(value);
	eachTarget(target, function(curElem){
		curElem[prop] =setValue;
	});

	return elem;
}

function setAttr(elem, name, value){
	if(value == null){
		elem.removeAttribute(name);
	}else{
		elem.setAttribute(name, value);
	}
}

function setStyle(elem, name, value){
	value =value == null ? '' : value;

	if(name.indexOf('-') !== -1){
		elem.style.setProperty(name, value);
	}else{
		elem.style[name] =value;
	}
}

function isElement(value){
	return !!(value && value.nodeType === 1);
}

function isNode(value){
	return !!(value && typeof value.nodeType === 'number');
}

/**
 * 判断节点是否包含另一个节点
 */
function contains(root, elem){
	if(!root || !elem) return false;
	if(root === elem) return true;
	if(root.contains) return root.contains(elem);

	return !!(root.compareDocumentPosition && (root.compareDocumentPosition(elem) & 16));
}

/**
 * 判断节点是否匹配选择器
 */
function matches(elem, selector){
	if(!isElement(elem) || typeof selector !== 'string' || !selector) return false;

	var func =elem.matches || elem.webkitMatchesSelector;
	return !!(func && func.call(elem, selector));
}

function parentElem(elem){
	if(!elem) return null;
	return elem.parentElement || (elem.parentNode && elem.parentNode.nodeType === 1 ? elem.parentNode : null);
}

function siblingElem(elem, prop, nodeProp){
	if(!elem) return null;
	if(elem[prop] !== undefined) return elem[prop];

	elem =elem[nodeProp];
	while(elem && elem.nodeType !== 1) elem =elem[nodeProp];

	return elem || null;
}

function getWindowScroll(name){
	if(!doc) return 0;

	if(name === 'top'){
		if(typeof global.pageYOffset === 'number') return global.pageYOffset;
		return (doc.documentElement && doc.documentElement.scrollTop) || (doc.body && doc.body.scrollTop) || 0;
	}

	if(typeof global.pageXOffset === 'number') return global.pageXOffset;
	return (doc.documentElement && doc.documentElement.scrollLeft) || (doc.body && doc.body.scrollLeft) || 0;
}

function scrollValue(target, value, name){
	var elem =firstTarget(target);
	if(!elem) return value === undefined ? undefined : null;

	var isTop =name === 'scrollTop';

	if(value === undefined){
		if(elem === global || elem === doc) return getWindowScroll(isTop ? 'top' : 'left');
		return elem[name] || 0;
	}

	value =base.floatval(value, 0);

	eachTarget(target, function(curElem){
		if(curElem === global || curElem === doc){
			var left =isTop ? getWindowScroll('left') : value,
			top =isTop ? value : getWindowScroll('top');

			if(typeof global.scrollTo === 'function'){
				global.scrollTo(left, top);
			}else if(doc){
				if(doc.documentElement){
					doc.documentElement.scrollLeft =left;
					doc.documentElement.scrollTop =top;
				}

				if(doc.body){
					doc.body.scrollLeft =left;
					doc.body.scrollTop =top;
				}
			}

			return;
		}

		curElem[name] =value;
	});

	return elem;
}

function sizeValue(target, type){
	var elem =firstTarget(target);
	if(!elem) return undefined;

	if(elem === global){
		if(type === 'width'){
			return global.innerWidth || (doc && doc.documentElement ? doc.documentElement.clientWidth : 0);
		}

		return global.innerHeight || (doc && doc.documentElement ? doc.documentElement.clientHeight : 0);
	}

	if(elem === doc){
		var root =doc.documentElement,
		body =doc.body;

		if(type === 'width'){
			return Math.max(
				root ? root.scrollWidth || 0 : 0,
				root ? root.offsetWidth || 0 : 0,
				root ? root.clientWidth || 0 : 0,
				body ? body.scrollWidth || 0 : 0,
				body ? body.offsetWidth || 0 : 0
			);
		}

		return Math.max(
			root ? root.scrollHeight || 0 : 0,
			root ? root.offsetHeight || 0 : 0,
			root ? root.clientHeight || 0 : 0,
			body ? body.scrollHeight || 0 : 0,
			body ? body.offsetHeight || 0 : 0
		);
	}

	if(elem.getBoundingClientRect){
		var rect =elem.getBoundingClientRect(),
		size =type === 'width' ? rect.width : rect.height;

		if(typeof size === 'number') return size;

		return type === 'width'
			? rect.right - rect.left
			: rect.bottom - rect.top;
	}

	return type === 'width' ? elem.offsetWidth : elem.offsetHeight;
}

function disabledMethod(target, stat){
	var elem =firstTarget(target);
	if(!elem) return stat === undefined ? undefined : null;

	if(stat === undefined){
		return 'disabled' in elem ? !!elem.disabled : undefined;
	}

	eachTarget(target, function(curElem){
		if('disabled' in curElem) curElem.disabled =!!stat;
	});

	return elem;
}

function btnSetDisabled(pElem, selector, stat){
	var elem =firstTarget(pElem);
	if(!elem) return null;

	if('disabled' in elem){
		elem.disabled =!!stat;
		return elem;
	}

	var btn =elem.querySelector(selector || 'button[type="submit"],input[type="submit"]');
	if(!btn || !('disabled' in btn)) return null;

	btn.disabled =!!stat;
	return btn;
}

global.ymzDom ={
	getId: base.getId,
    injectStyle: base.injectStyle,
	get: queryElem,
	all: all,
	createElem: createElem,

	isElement: isElement,
	isNode: isNode,

	ready: function(callback){
		if(typeof callback !== 'function') throw new TypeError('ready callback must be a function');
		if(!doc) return false;

		if(doc.readyState === 'loading'){
			doc.addEventListener('DOMContentLoaded', callback, false);
		}else{
			global.setTimeout(callback, 0);
		}

		return true;
	},

	html: function(target, value){
		return contentMethod(target, value, 'innerHTML');
	},

	text: function(target, value){
		return contentMethod(target, value, 'textContent');
	},

	val: function(target, value){
		return contentMethod(target, value, 'value');
	},

	prop: function(target, name, value){
		var isObjectSet =name && typeof name === 'object',
		elem =firstTarget(target);

		if(!elem){
			return isObjectSet || value !== undefined ? null : undefined;
		}

		if(isObjectSet){
			eachTarget(target, function(curElem){
				for(var key in name){
					if(key !== '__proto__' && base.hasOwn(name, key)){
						curElem[key] =name[key];
					}
				}
			});

			return elem;
		}

		if(value === undefined) return elem[name];
		if(name === '__proto__') return elem;

		eachTarget(target, function(curElem){
			curElem[name] =value;
		});

		return elem;
	},

	show: function(target){
		eachTarget(target, function(elem){
			elem.hidden =false;
		});

		return target;
	},

	hide: function(target){
		eachTarget(target, function(elem){
			elem.hidden =true;
		});

		return target;
	},

	toggle: function(target, force){
		eachTarget(target, function(elem){
			elem.hidden =force == null ? !elem.hidden : !force;
		});

		return target;
	},

	addClass: function(target, name){
		eachTarget(target, function(elem){
			if(!elem.classList) return;

			eachClassName(name, function(className){
				elem.classList.add(className);
			});
		});

		return target;
	},

	removeClass: function(target, name){
		eachTarget(target, function(elem){
			if(!elem.classList) return;

			if(name == null || base.trim(name) === ''){
				elem.removeAttribute('class');
				return;
			}

			eachClassName(name, function(className){
				elem.classList.remove(className);
			});
		});

		return target;
	},

	toggleClass: function(target, name, force){
		eachTarget(target, function(elem){
			if(!elem.classList) return;

			eachClassName(name, function(className){
				if(force == null){
					elem.classList.toggle(className);
				}else if(force){
					elem.classList.add(className);
				}else{
					elem.classList.remove(className);
				}
			});
		});

		return target;
	},

	hasClass: function(target, name){
		name =base.trim(name);
		if(!name) return false;

		var names =name.split(/\s+/),
		found =false;

		eachTarget(target, function(elem){
			if(!elem.classList) return;

			for(var i=0, len=names.length; i<len; i++){
				if(names[i] && !elem.classList.contains(names[i])){
					return;
				}
			}

			found =true;
			return false;
		});

		return found;
	},

	attr: function(target, name, value){
		var isObjectSet =name && typeof name === 'object',
		elem =firstTarget(target);

		if(!elem){
			return isObjectSet || value !== undefined ? null : undefined;
		}

		if(isObjectSet){
			eachTarget(target, function(curElem){
				for(var key in name){
					if(base.hasOwn(name, key)){
						setAttr(curElem, key, name[key]);
					}
				}
			});

			return elem;
		}

		if(value === undefined) return elem.getAttribute(name);

		eachTarget(target, function(curElem){
			setAttr(curElem, name, value);
		});

		return elem;
	},

	hasAttr: function(target, name){
		var elem =firstTarget(target);
		if(!elem) return false;

		return elem.hasAttribute
			? elem.hasAttribute(name)
			: elem.getAttribute(name) !== null;
	},

	removeAttr: function(target, name){
		eachTarget(target, function(elem){
			elem.removeAttribute(name);
		});

		return target;
	},

	data: function(target, name, value){
		var elem =firstTarget(target);
		if(!elem) return value === undefined ? undefined : null;

		var attrName =camelToData(name);

		if(value === undefined){
			return elem.getAttribute(attrName);
		}

		eachTarget(target, function(curElem){
			setAttr(curElem, attrName, value);
		});

		return elem;
	},

	removeData: function(target, name){
		var attrName =camelToData(name);

		eachTarget(target, function(elem){
			elem.removeAttribute(attrName);
		});

		return target;
	},

	css: function(target, name, value){
		var isObjectSet =name && typeof name === 'object',
		elem =firstTarget(target);

		if(!elem){
			return isObjectSet || value !== undefined ? null : undefined;
		}

		if(isObjectSet){
			eachTarget(target, function(curElem){
				for(var key in name){
					if(base.hasOwn(name, key)){
						setStyle(curElem, key, name[key]);
					}
				}
			});

			return elem;
		}

		if(value === undefined){
			var style =global.getComputedStyle
				? global.getComputedStyle(elem)
				: elem.style;

			if(name.indexOf('-') !== -1 && style.getPropertyValue){
				return style.getPropertyValue(name);
			}

			return style[name];
		}

		eachTarget(target, function(curElem){
			setStyle(curElem, name, value);
		});

		return elem;
	},

	empty: function(target){
		eachTarget(target, function(elem){
			elem.innerHTML ='';
		});

		return target;
	},

	append: function(target, content){
		var elem =firstTarget(target);
		if(!elem) return null;

		if(typeof content === 'string'){
			elem.insertAdjacentHTML('beforeend', content);
		}else if(content){
			elem.appendChild(content);
		}

		return elem;
	},

	prepend: function(target, content){
		var elem =firstTarget(target);
		if(!elem) return null;

		if(typeof content === 'string'){
			elem.insertAdjacentHTML('afterbegin', content);
		}else if(content){
			elem.insertBefore(content, elem.firstChild);
		}

		return elem;
	},

	before: function(target, content){
		var elem =firstTarget(target);
		if(!elem || !elem.parentNode) return null;

		if(typeof content === 'string'){
			elem.insertAdjacentHTML('beforebegin', content);
		}else if(content){
			elem.parentNode.insertBefore(content, elem);
		}

		return elem;
	},

	after: function(target, content){
		var elem =firstTarget(target);
		if(!elem || !elem.parentNode) return null;

		if(typeof content === 'string'){
			elem.insertAdjacentHTML('afterend', content);
		}else if(content){
			elem.parentNode.insertBefore(content, elem.nextSibling);
		}

		return elem;
	},

	remove: function(target){
		eachTarget(target, function(elem){
			if(elem.parentNode){
				elem.parentNode.removeChild(elem);
			}
		});

		return target;
	},

	contains: contains,
	matches: matches,

	parent: function(target, selector){
		var elem =parentElem(firstTarget(target));

		if(!elem) return null;
		if(selector && !matches(elem, selector)) return null;

		return elem;
	},

	children: function(target, selector){
		var elem =firstTarget(target);
		if(!elem) return [];

		var list =[],
		children =elem.children;

		if(children){
			for(var i=0, len=children.length; i<len; i++){
				if(!selector || matches(children[i], selector)){
					list.push(children[i]);
				}
			}

			return list;
		}

		var nodes =elem.childNodes || [];

		for(var j=0, nodeLen=nodes.length; j<nodeLen; j++){
			if(nodes[j].nodeType === 1 && (!selector || matches(nodes[j], selector))){
				list.push(nodes[j]);
			}
		}

		return list;
	},

	siblings: function(target, selector){
		var elem =firstTarget(target),
		parent =parentElem(elem);

		if(!elem || !parent) return [];

		var list =[],
		children =parent.children || parent.childNodes || [];

		for(var i=0, len=children.length; i<len; i++){
			var child =children[i];

			if(child === elem || child.nodeType !== 1) continue;

			if(!selector || matches(child, selector)){
				list.push(child);
			}
		}

		return list;
	},

	next: function(target, selector){
		var elem =siblingElem(firstTarget(target), 'nextElementSibling', 'nextSibling');

		if(!elem) return null;
		if(selector && !matches(elem, selector)) return null;

		return elem;
	},

	prev: function(target, selector){
		var elem =siblingElem(firstTarget(target), 'previousElementSibling', 'previousSibling');

		if(!elem) return null;
		if(selector && !matches(elem, selector)) return null;

		return elem;
	},

	closest: function(target, selector, stop){
		var elem =firstTarget(target),
		stopElem =null;

		if(!elem) return null;

		if(stop != null){
			stopElem =firstTarget(stop);
			if(!stopElem) return null;
		}

		if(elem.nodeType !== 1){
			elem =elem.parentElement || elem.parentNode;
		}

		if(stopElem && !contains(stopElem, elem)) return null;

		while(elem && elem !== doc){
			if(elem.nodeType === 1 && matches(elem, selector)){
				return elem;
			}

			if(stopElem && elem === stopElem) break;

			elem =elem.parentElement || elem.parentNode;
		}

		return null;
	},

	rect: function(target){
		var elem =firstTarget(target);

		if(!elem || !elem.getBoundingClientRect){
			return null;
		}

		return elem.getBoundingClientRect();
	},

	offset: function(target){
		var elem =firstTarget(target);

		if(!elem || !elem.getBoundingClientRect){
			return null;
		}

		var rect =elem.getBoundingClientRect();

		return {
			top: rect.top + getWindowScroll('top'),
			left: rect.left + getWindowScroll('left')
		};
	},

	width: function(target){
		return sizeValue(target, 'width');
	},

	height: function(target){
		return sizeValue(target, 'height');
	},

	scrollTop: function(target, value){
		return scrollValue(target, value, 'scrollTop');
	},

	scrollLeft: function(target, value){
		return scrollValue(target, value, 'scrollLeft');
	},

	focus: function(target){
		var elem =firstTarget(target);

		if(!elem || typeof elem.focus !== 'function'){
			return null;
		}

		elem.focus();
		return elem;
	},

	blur: function(target){
		var elem =firstTarget(target);

		if(!elem || typeof elem.blur !== 'function'){
			return null;
		}

		elem.blur();
		return elem;
	},

	disabled: function(target, stat){
		return disabledMethod(target, stat);
	},

	btnDisabled: function(pElem, selector){
		return btnSetDisabled(pElem, selector, true);
	},

	btnEnabled: function(pElem, selector){
		return btnSetDisabled(pElem, selector, false);
	}
};

}(window));

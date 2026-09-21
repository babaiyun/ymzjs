/*! ymzMessage v1.0.0 */
(function(win){
    'use strict';

    if(win.ymzMessage) return;

    var base =win.ymzBase;
    if(!base) throw new Error('ymzBase is required');

    var doc =win.document,
        seq =0,
        messageMap =Object.create(null),
        config ={
            duration:2500,
            position:'top-right'
        };

    function ensureStyle(){
        base.injectStyle(
            'ymz_message_style',
            '.ymz-message-wrap{position:fixed;z-index:10050;display:flex;flex-direction:column;gap:10px;pointer-events:none;max-width:420px}' +
            '.ymz-message-wrap.top-right{top:20px;right:20px;align-items:flex-end}' +
            '.ymz-message-wrap.top-center{top:20px;left:50%;transform:translateX(-50%);align-items:center}' +
            '.ymz-message-wrap.bottom-right{right:20px;bottom:20px;align-items:flex-end}' +
            '.ymz-message-wrap.bottom-center{left:50%;bottom:20px;transform:translateX(-50%);align-items:center}' +
            '.ymz-message{box-sizing:border-box;min-width:220px;max-width:420px;padding:11px 14px;border-radius:6px;background:#fff;border:1px solid #ddd;box-shadow:0 8px 28px rgba(0,0,0,.14);font-size:14px;line-height:1.5;pointer-events:auto;display:flex;align-items:flex-start;gap:10px}' +
            '.ymz-message.success{border-left:4px solid #2e9d5b}' +
            '.ymz-message.error{border-left:4px solid #d64545}' +
            '.ymz-message.warning{border-left:4px solid #d69a2d}' +
            '.ymz-message.info{border-left:4px solid #3f7fc4}' +
            '.ymz-message-text{flex:1;min-width:0;word-break:break-word}' +
            '.ymz-message-close{flex:0 0 auto;border:0;background:none;padding:0 2px;cursor:pointer;font-size:17px;line-height:1;color:#777}' +
            '.ymz-message-close:hover{color:#333}'
        );

    }

    function normalizePosition(position, fallback){
        if(position == null){
            return fallback;
        }

        position =String(position);
        return position ? position : fallback;
    }

    function normalizeDuration(duration, fallback){
        if(duration == null){
            return fallback;
        }

        duration =Number(duration);

        if(!isFinite(duration) || duration < 0){
            return fallback;
        }

        if(duration > 2147483647){
            return 2147483647;
        }

        return duration;
    }

    function getWrap(position){
        var id ='ymz_message_wrap_' + position.replace(/[^a-z0-9_-]/ig, '_');
        var wrap =doc.getElementById(id);

        if(wrap) return wrap;

        wrap =doc.createElement('div');
        wrap.id =id;
        wrap.className ='ymz-message-wrap ' + position;

        (doc.body || doc.documentElement).appendChild(wrap);
        return wrap;
    }

    function close(id){
        var item =messageMap[id];
        if(!item) return false;

        if(item.timer !== null){
            win.clearTimeout(item.timer);
            item.timer =null;
        }

        if(item.elem && item.elem.parentNode){
            item.elem.parentNode.removeChild(item.elem);
        }

        if(item.wrap && !item.wrap.firstChild && item.wrap.parentNode){
            item.wrap.parentNode.removeChild(item.wrap);
        }

        delete messageMap[id];
        return true;
    }

    function show(message, option){
        ensureStyle();
        option =option && typeof option === 'object' ? option : {};

        var id ='ymz_msg_' + (++seq),
            type =option.type == null ? 'info' : String(option.type),
            duration =normalizeDuration(option.duration, config.duration),
            position =normalizePosition(option.position, config.position),
            wrap =getWrap(position),
            elem =doc.createElement('div'),
            text =doc.createElement('div');

        elem.className ='ymz-message ' + type;
        elem.setAttribute('data-ymz-message-id', id);
        elem.setAttribute('role', type === 'error' ? 'alert' : 'status');

        text.className ='ymz-message-text';
        text.textContent =message == null ? '' : String(message);
        elem.appendChild(text);

        if(option.closable !== false){
            var btn =doc.createElement('button');
            btn.type ='button';
            btn.className ='ymz-message-close';
            btn.setAttribute('aria-label', '关闭');
            btn.textContent ='×';
            btn.onclick =function(){
                close(id);
            };
            elem.appendChild(btn);
        }

        wrap.appendChild(elem);

        var item ={
            id:id,
            elem:elem,
            wrap:wrap,
            timer:null
        };

        messageMap[id] =item;

        if(duration > 0){
            item.timer =win.setTimeout(function(){
                close(id);
            }, duration);
        }

        return id;
    }

    function showType(type, message, option){
        option =option && typeof option === 'object' ? option : {};

        return show(
            message,
            base.extend({}, option, {type:type})
        );
    }

    function clear(){
        var ids =Object.keys(messageMap);

        for(var i=0,len=ids.length; i<len; i++){
            close(ids[i]);
        }

        return ids.length;
    }

    var api =win.ymzMessage ={
        config:function(option){
            option =option && typeof option === 'object' ? option : {};

            if(option.duration != null){
                config.duration =normalizeDuration(
                    option.duration,
                    config.duration
                );
            }

            if(option.position != null){
                config.position =normalizePosition(
                    option.position,
                    config.position
                );
            }

            return api;
        },

        show:show,

        success:function(message, option){
            return showType('success', message, option);
        },

        error:function(message, option){
            return showType('error', message, option);
        },

        warning:function(message, option){
            return showType('warning', message, option);
        },

        info:function(message, option){
            return showType('info', message, option);
        },

        close:close,
        clear:clear
    };

}(window));

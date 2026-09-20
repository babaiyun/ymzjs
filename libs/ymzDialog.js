/*! ymzDialog v2.0.0 */
(function(global){
    'use strict';

    if(global.ymzDialog) return;

    var base =global.ymzBase;
    if(!base) throw new Error('ymzBase is required');

    var doc =base.getDoc(),
        reportError =base.reportError || function(error){
            global.setTimeout(function(){
                throw error;
            }, 0);
        },
        seq =0,
        current =null,
        styleId ='ymz_dialog_style';

    function ensureStyle(){
        if(!doc) return null;

        var currentStyle =doc.getElementById(styleId);
        if(currentStyle) return currentStyle;

        var style =doc.createElement('style'),
            config =typeof base.config === 'function' ? base.config() : null;

        style.id =styleId;
        style.type ='text/css';

        if(config && config.styleNonce){
            style.setAttribute('nonce', config.styleNonce);
        }

        style.textContent =
            '.ymz-dialog-mask{position:fixed;inset:0;z-index:10040;background:rgba(0,0,0,.38);display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}' +
            '.ymz-dialog{width:min(520px,100%);max-height:calc(100vh - 48px);background:#fff;border-radius:8px;box-shadow:0 18px 60px rgba(0,0,0,.22);display:flex;flex-direction:column;overflow:hidden;outline:0}' +
            '.ymz-dialog-head{display:flex;align-items:center;gap:10px;padding:16px 18px;border-bottom:1px solid #eee}' +
            '.ymz-dialog-title{flex:1;font-weight:600;font-size:16px}' +
            '.ymz-dialog-close{border:0;background:none;padding:0 2px;font-size:22px;line-height:1;cursor:pointer;color:#777}' +
            '.ymz-dialog-close img {display:block; width:16px; height:16px; pointer-events:none;}' +
            '.ymz-dialog-body{padding:18px;overflow:auto;line-height:1.7}' +
            '.ymz-dialog-foot{display:flex;justify-content:flex-end;gap:10px;padding:13px 18px;border-top:1px solid #eee}' +
            '.ymz-dialog-btn{padding:7px 15px;border-radius:5px;border:1px solid #bbb;background:#fff;cursor:pointer}' +
            '.ymz-dialog-btn.primary{color:#fff;background:#2868c7;border-color:#2868c7}' +
            '.ymz-dialog-input{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #bbb;border-radius:5px;font:inherit}';

        (doc.head || doc.documentElement).appendChild(style);

        return style;
    }

    function normalizeOption(option){
        if(option == null){
            return {};
        }

        if(typeof option !== 'object' || Array.isArray(option)){
            throw new TypeError('dialog option must be an object');
        }

        return option;
    }

    function restoreFocus(item){
        var elem =item.previousFocus;

        if(
            elem &&
            typeof elem.focus === 'function' &&
            doc.documentElement &&
            doc.documentElement.contains(elem)
        ){
            try{
                elem.focus();
            }catch(e){}
        }
    }

    function focusDefault(item){
        if(current !== item || item.option.autoFocus === false){
            return;
        }

        if(doc.activeElement && item.box.contains(doc.activeElement)){
            return;
        }

        var target =item.box.querySelector(
            '.ymz-dialog-btn.primary,' +
            '[autofocus],' +
            'input:not([disabled]),' +
            'select:not([disabled]),' +
            'textarea:not([disabled]),' +
            'button:not([disabled]),' +
            'a[href],' +
            '[tabindex]:not([tabindex="-1"])'
        );

        if(!target){
            target =item.box;
        }

        try{
            target.focus();
        }catch(e){}
    }

    function callFunc(func, args){
        if(typeof func !== 'function'){
            return undefined;
        }

        try{
            return func.apply(null, args || []);
        }catch(e){
            reportError(e);
            return false;
        }
    }

    function closeItem(item, reason){
        if(!item || current !== item){
            return false;
        }

        current =null;

        if(item.keyHandler){
            doc.removeEventListener('keydown', item.keyHandler, true);
            item.keyHandler =null;
        }

        if(item.mask){
            item.mask.onclick =null;
        }

        if(item.yesBtn){
            item.yesBtn.onclick =null;
        }

        if(item.noBtn){
            item.noBtn.onclick =null;
        }

        if(item.closeBtn){
            item.closeBtn.onclick =null;
        }

        if(item.mask && item.mask.parentNode){
            item.mask.parentNode.removeChild(item.mask);
        }

        restoreFocus(item);

        callFunc(
            item.option.onClose,
            [reason || 'api', item.controller]
        );

        return true;
    }

    function close(){
        if(!current){
            return false;
        }

        return closeItem(current, 'api');
    }

    function runYes(item){
        if(!item || current !== item){
            return false;
        }

        var result =callFunc(
            item.option.yesFunc,
            [item.controller]
        );

        if(result === false){
            return false;
        }

        return closeItem(item, 'yes');
    }

    function runNo(item, reason){
        if(!item || current !== item){
            return false;
        }

        var result =callFunc(
            item.option.noFunc,
            [item.controller]
        );

        if(result === false){
            return false;
        }

        return closeItem(item, reason || 'no');
    }

    function appendContent(body, option){
        if(option.contentNode && option.contentNode.nodeType){
            body.appendChild(option.contentNode);
            return;
        }

        if(option.contentText != null){
            body.textContent =String(option.contentText);
            return;
        }

        if(option.content != null){
            if(option.html === false){
                body.textContent =String(option.content);
            }else{
                body.innerHTML =String(option.content);
            }
        }
    }

    function createButton(text, primary){
        if(text === false || text == null){
            return null;
        }

        var btn =doc.createElement('button');

        btn.type ='button';
        btn.className =
            'ymz-dialog-btn' +
            (primary ? ' primary' : '');

        btn.textContent =String(text);

        return btn;
    }

    function createCloseImage(){
        var img =doc.createElement('img');
        img.src ='data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M5 5L19 19M19 5L5 19" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round"/></svg>');
        img.alt ='';
        img.draggable =false;
        return img;
    }

    function open(option){
        option =normalizeOption(option);

        if(!doc){
            throw new Error('[ymzDialog] document is unavailable');
        }

        ensureStyle();

        if(current){
            closeItem(current, 'replace');
        }

        var id ='ymz_dialog_' + (++seq),
            mask =doc.createElement('div'),
            box =doc.createElement('div'),
            head =doc.createElement('div'),
            title =doc.createElement('div'),
            closeBtn =doc.createElement('button'),
            body =doc.createElement('div'),
            foot =doc.createElement('div'),
            noBtnText =option.noBtn === undefined ? false : option.noBtn,
            yesBtnText =option.yesBtn === undefined ? '确定' : option.yesBtn,
            noBtn =createButton(noBtnText, false),
            yesBtn =createButton(yesBtnText, true),
            item,
            controller;

        mask.className ='ymz-dialog-mask';
        mask.setAttribute('data-ymz-dialog-id', id);

        box.className ='ymz-dialog';
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');
        box.setAttribute('tabindex', '-1');

        if(option.width){
            box.style.width =typeof option.width === 'number'
                ? option.width + 'px'
                : String(option.width);
        }

        head.className ='ymz-dialog-head';

        title.id =id + '_title';
        title.className ='ymz-dialog-title';
        title.textContent =option.title == null
            ? '提示'
            : String(option.title);

        box.setAttribute('aria-labelledby', title.id);

        closeBtn.type ='button';
        closeBtn.className ='ymz-dialog-close';
        closeBtn.setAttribute('aria-label', '关闭');
        closeBtn.appendChild(createCloseImage());

        head.appendChild(title);

        if(option.showClose !== false){
            head.appendChild(closeBtn);
        }

        body.className ='ymz-dialog-body';
        appendContent(body, option);

        foot.className ='ymz-dialog-foot';

        if(noBtn){
            foot.appendChild(noBtn);
        }

        if(yesBtn){
            foot.appendChild(yesBtn);
        }

        box.appendChild(head);
        box.appendChild(body);

        if(noBtn || yesBtn){
            box.appendChild(foot);
        }

        mask.appendChild(box);

        controller ={
            id:id,
            elem:box,
            body:body,

            close:function(){
                return closeItem(item, 'api');
            },

            yes:function(){
                return runYes(item);
            },

            no:function(){
                return runNo(item, 'no');
            }
        };

        item ={
            id:id,
            mask:mask,
            box:box,
            body:body,
            noBtn:noBtn,
            yesBtn:yesBtn,
            closeBtn:closeBtn,
            option:option,
            controller:controller,
            keyHandler:null,
            previousFocus:doc.activeElement || null
        };

        current =item;

        closeBtn.onclick =function(){
            runNo(item, 'close');
        };

        if(noBtn){
            noBtn.onclick =function(){
                runNo(item, 'no');
            };
        }

        if(yesBtn){
            yesBtn.onclick =function(){
                runYes(item);
            };
        }

        if(option.closeOnMask){
            mask.onclick =function(event){
                if(event.target === mask){
                    runNo(item, 'mask');
                }
            };
        }

        if(option.closeOnEsc !== false){
            item.keyHandler =function(event){
                if(event.key === 'Escape' || event.keyCode === 27){
                    runNo(item, 'esc');
                }
            };

            doc.addEventListener(
                'keydown',
                item.keyHandler,
                true
            );
        }

        (doc.body || doc.documentElement).appendChild(mask);

        callFunc(
            option.onOpen,
            [controller]
        );

        focusDefault(item);

        return controller;
    }

    function alertDialog(message, option){
        option =normalizeOption(option);

        var cfg =base.extend({}, option);

        cfg.contentText =message;
        cfg.html =false;
        cfg.noBtn =false;

        if(cfg.yesBtn === undefined){
            cfg.yesBtn =option.okText || '确定';
        }

        return open(cfg);
    }

    function confirmDialog(message, option){
        option =normalizeOption(option);

        var cfg =base.extend({}, option);

        cfg.contentText =message;
        cfg.html =false;

        if(cfg.noBtn === undefined){
            cfg.noBtn =option.cancelText || '取消';
        }

        if(cfg.yesBtn === undefined){
            cfg.yesBtn =option.okText || '确定';
        }

        return open(cfg);
    }

    function promptDialog(message, option){
        option =normalizeOption(option);

        var wrap =doc.createElement('div'),
            text =doc.createElement('div'),
            input =doc.createElement('input'),
            userYesFunc =option.yesFunc,
            userNoFunc =option.noFunc,
            cfg =base.extend({}, option),
            controller;

        text.textContent =message == null
            ? ''
            : String(message);

        text.style.marginBottom ='10px';

        input.type =option.type || 'text';
        input.className ='ymz-dialog-input';
        input.value =option.value == null
            ? ''
            : String(option.value);

        if(option.placeholder != null){
            input.placeholder =String(option.placeholder);
        }

        input.addEventListener('input', function(){
            input.setCustomValidity('');
        });

        wrap.appendChild(text);
        wrap.appendChild(input);

        cfg.title =option.title || '请输入';
        cfg.contentNode =wrap;
        cfg.noBtn =option.noBtn === undefined
            ? (option.cancelText || '取消')
            : option.noBtn;

        cfg.yesBtn =option.yesBtn === undefined
            ? (option.okText || '确定')
            : option.yesBtn;

        cfg.autoFocus =false;

        cfg.yesFunc =function(curController){
            var value =input.value;

            if(typeof option.validate === 'function'){
                var result;

                try{
                    result =option.validate(value);
                }catch(e){
                    reportError(e);
                    return false;
                }

                if(result === false){
                    return false;
                }

                if(typeof result === 'string' && result !== ''){
                    input.setCustomValidity(result);

                    if(input.reportValidity){
                        input.reportValidity();
                    }

                    return false;
                }
            }

            if(typeof userYesFunc === 'function'){
                return userYesFunc(
                    value,
                    curController
                );
            }
        };

        cfg.noFunc =function(curController){
            if(typeof userNoFunc === 'function'){
                return userNoFunc(curController);
            }
        };

        cfg.onOpen =function(curController){
            input.focus();
            input.select();

            if(typeof option.onOpen === 'function'){
                option.onOpen(curController, input);
            }
        };

        controller =open(cfg);
        controller.input =input;

        return controller;
    }

    global.ymzDialog ={
        open:open,
        close:close,
        alert:alertDialog,
        confirm:confirmDialog,
        prompt:promptDialog,

        isOpen:function(){
            return !!current;
        },

        current:function(){
            return current
                ? current.box
                : null;
        }
    };

}(typeof globalThis !== 'undefined'
    ? globalThis
    : (typeof window !== 'undefined' ? window : this)));

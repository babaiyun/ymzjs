(function(global){
    'use strict';

    if(global.ymzPopupPage) return;

    var styleId ='ymz-popup-page-style';
    var baseZIndex =100000;
    var popupSeq =0;
    var popupList =[];
    var pageLockData =null;
    var globalKeydownHandler =null;

    function initStyle(){
        if(document.getElementById(styleId)) return;

        var style =document.createElement('style');
        style.id =styleId;
        style.textContent =`
.ymz-popup-page-overlay{
    position:fixed;
    inset:0;
    display:flex;
    align-items:center;
    justify-content:center;
    box-sizing:border-box;
    background:rgba(0,0,0,.55);
    overflow:hidden;
    overscroll-behavior:none;
}

.ymz-popup-page{
    position:relative;
    width:98%;
    height:96%;
    max-width:100vw;
    max-height:100vh;
    box-sizing:border-box;
    background:#fff;
    border-radius:8px;
    overflow:hidden;
    box-shadow:0 10px 40px rgba(0,0,0,.28);
}

.ymz-popup-page-full-width{
    width:100vw !important;
    border-radius:0;
}

.ymz-popup-page-full-screen{
    width:100vw !important;
    height:100vh !important;
    height:100dvh !important;
    border-radius:0;
}

.ymz-popup-page-body{
    width:100%;
    height:100%;
    box-sizing:border-box;
    overflow:auto;
    overscroll-behavior:contain;
    -webkit-overflow-scrolling:touch;
}

.ymz-popup-page-close{
    position:absolute;
    z-index:10;
    top:12px;
    right:14px;
    display:flex;
    align-items:center;
    justify-content:center;
    width:32px;
    height:32px;
    padding:0;
    border:0;
    border-radius:50%;
    background:rgba(0,0,0,.50);
    cursor:pointer;
    user-select:none;
}

.ymz-popup-page-close img{
    display:block;
    width:16px;
    height:16px;
    pointer-events:none;
}

.ymz-popup-page-close:hover{
    background:rgba(0,0,0,.75);
}
`;

        document.head.appendChild(style);
    }

    function createCloseImage(){
        var img =document.createElement('img');
        img.src ='data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M5 5L19 19M19 5L5 19" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>');
        img.alt ='';
        img.draggable =false;

        return img;
    }

    function lockPage(){
        if(pageLockData) return;

        var html =document.documentElement;
        var body =document.body;
        var scrollbarWidth =global.innerWidth -html.clientWidth;

        pageLockData ={
            htmlOverflow:html.style.overflow,
            bodyOverflow:body.style.overflow,
            bodyPaddingRight:body.style.paddingRight
        };

        html.style.overflow ='hidden';
        body.style.overflow ='hidden';

        if(scrollbarWidth >0){
            var paddingRight =parseFloat(global.getComputedStyle(body).paddingRight) || 0;
            body.style.paddingRight =(paddingRight +scrollbarWidth) +'px';
        }
    }

    function unlockPage(){
        if(!pageLockData) return;

        var html =document.documentElement;
        var body =document.body;

        html.style.overflow =pageLockData.htmlOverflow;
        body.style.overflow =pageLockData.bodyOverflow;
        body.style.paddingRight =pageLockData.bodyPaddingRight;

        pageLockData =null;
    }

    function bindGlobalKeydown(){
        if(globalKeydownHandler) return;

        globalKeydownHandler =function(e){
            if(e.key !=='Escape' || popupList.length ===0) return;

            var item =popupList[popupList.length -1];
            if(item.options.escClose !==false){
                close(item.id);
            }
        };

        document.addEventListener('keydown', globalKeydownHandler);
    }

    function unbindGlobalKeydown(){
        if(!globalKeydownHandler) return;

        document.removeEventListener('keydown', globalKeydownHandler);
        globalKeydownHandler =null;
    }

    function getPopup(id){
        if(popupList.length ===0) return null;

        if(id ==null){
            return popupList[popupList.length -1];
        }

        for(var i=popupList.length -1; i>=0; i--){
            if(popupList[i].id ===id){
                return popupList[i];
            }
        }

        return null;
    }

    function removePopupData(id){
        for(var i=popupList.length -1; i>=0; i--){
            if(popupList[i].id ===id){
                popupList.splice(i, 1);
                return;
            }
        }
    }

    function getCapture(options){
        if(typeof options ==='boolean'){
            return options;
        }

        return !!(options && options.capture);
    }

    function addEvent(item, target, type, handler, options){
        if(!target || typeof target.addEventListener !=='function'){
            throw new TypeError('ymzPopupPage.on target must support addEventListener');
        }

        if(typeof type !=='string' || type ===''){
            throw new TypeError('ymzPopupPage.on event type must be a non-empty string');
        }

        if(typeof handler !=='function'){
            throw new TypeError('ymzPopupPage.on handler must be a function');
        }

        target.addEventListener(type, handler, options);

        item.eventList.push({
            target:target,
            type:type,
            handler:handler,
            capture:getCapture(options)
        });

        return handler;
    }

    function clearEvents(item){
        for(var i=item.eventList.length -1; i>=0; i--){
            var event =item.eventList[i];

            event.target.removeEventListener(
                event.type,
                event.handler,
                event.capture
            );
        }

        item.eventList.length =0;
    }

    function addCleanup(item, cleanup){
        if(typeof cleanup !=='function'){
            throw new TypeError('ymzPopupPage.addCleanup cleanup must be a function');
        }

        item.cleanupList.push(cleanup);
        return cleanup;
    }

    function runCleanup(item){
        var firstError =null;

        for(var i=item.cleanupList.length -1; i>=0; i--){
            try{
                item.cleanupList[i]();
            }catch(e){
                if(firstError ===null){
                    firstError =e;
                }
            }
        }

        item.cleanupList.length =0;
        return firstError;
    }

    function applyRenderResult(item, result){
        if(result ==null || item.closing) return;
        if(!getPopup(item.id)) return;

        if(typeof result ==='string'){
            item.body.innerHTML =result;
            return;
        }

        if(result && result.nodeType){
            item.body.innerHTML ='';
            item.body.appendChild(result);
        }
    }

    function open(render, options){
        initStyle();

        options =options || {};

        if(popupList.length ===0){
            lockPage();
            bindGlobalKeydown();
        }

        popupSeq++;

        var id =popupSeq;
        var overlay =document.createElement('div');
        var popup =document.createElement('div');
        var body =document.createElement('div');

        overlay.className ='ymz-popup-page-overlay';
        overlay.style.zIndex =String(baseZIndex +(popupList.length *10));

        popup.className ='ymz-popup-page';
        body.className ='ymz-popup-page-body';

        if(options.fullScreen){
            popup.classList.add('ymz-popup-page-full-screen');
        }else{
            if(options.fullWidth){
                popup.classList.add('ymz-popup-page-full-width');
            }

            if(options.width){
                popup.style.width =options.width;
            }

            if(options.height){
                popup.style.height =options.height;
            }
        }

        if(options.className){
            popup.classList.add(options.className);
        }

        popup.setAttribute('role', 'dialog');
        popup.setAttribute('aria-modal', 'true');

        popup.appendChild(body);
        overlay.appendChild(popup);

        var item ={
            id:id,
            overlay:overlay,
            popup:popup,
            body:body,
            options:options,
            activeElement:document.activeElement,
            eventList:[],
            cleanupList:[],
            closing:false
        };

        if(options.closeButton !==false){
            var closeBtn =document.createElement('button');

            closeBtn.type ='button';
            closeBtn.className ='ymz-popup-page-close';
            closeBtn.setAttribute('aria-label', '关闭');
            closeBtn.appendChild(createCloseImage());

            popup.appendChild(closeBtn);
            item.closeBtn =closeBtn;

            addEvent(item, closeBtn, 'click', function(){
                close(id);
            });
        }

        addEvent(item, overlay, 'click', function(e){
            if(e.target !==overlay) return;

            if(options.maskClose !==false){
                close(id);
            }
        });

        popupList.push(item);
        document.body.appendChild(overlay);

        var api ={
            id:id,
            body:body,
            popup:popup,

            close:function(){
                return close(id);
            },

            open:function(childRender, childOptions){
                return open(childRender, childOptions);
            },

            setHtml:function(html){
                body.innerHTML =html ==null ? '' :String(html);
            },

            on:function(target, type, handler, eventOptions){
                return addEvent(item, target, type, handler, eventOptions);
            },

            addCleanup:function(cleanup){
                return addCleanup(item, cleanup);
            }
        };

        if(typeof render ==='string'){
            body.innerHTML =render;
        }else if(render && render.nodeType){
            body.appendChild(render);
        }else if(typeof render ==='function'){
            try{
                var result =render(body, api);

                if(result && typeof result.then ==='function'){
                    result.then(function(asyncResult){
                        applyRenderResult(item, asyncResult);
                    }).catch(function(err){
                        if(!item.closing && getPopup(item.id)){
                            body.innerHTML ='<div style="padding:30px;color:#b42318;">异步渲染失败：' +
                                String(err && err.message ? err.message : err) +
                                '</div>';
                        }
                    });
                }else{
                    applyRenderResult(item, result);
                }
            }catch(e){
                close(id);
                throw e;
            }
        }

        return id;
    }

    function close(id){
        var item =getPopup(id);
        if(!item || item.closing) return false;

        item.closing =true;

        var firstError =null;

        if(typeof item.options.onClose ==='function'){
            try{
                item.options.onClose(item.id);
            }catch(e){
                firstError =e;
            }
        }

        // 显式移除通过 popup.on() 及组件内部注册的事件
        clearEvents(item);

        // 清理定时器、Observer、第三方实例等外部资源
        var cleanupError =runCleanup(item);
        if(firstError ===null && cleanupError !==null){
            firstError =cleanupError;
        }

        if(item.overlay.parentNode){
            item.overlay.parentNode.removeChild(item.overlay);
        }

        removePopupData(item.id);

        if(popupList.length ===0){
            unbindGlobalKeydown();
            unlockPage();
        }

        if(item.activeElement && typeof item.activeElement.focus ==='function'){
            try{
                item.activeElement.focus();
            }catch(e){
                // 焦点恢复失败不影响弹窗关闭
            }
        }

        if(firstError !==null){
            throw firstError;
        }

        return true;
    }

    function closeAll(){
        var firstError =null;

        while(popupList.length >0){
            var id =popupList[popupList.length -1].id;

            try{
                close(id);
            }catch(e){
                if(firstError ===null){
                    firstError =e;
                }
            }
        }

        if(firstError !==null){
            throw firstError;
        }
    }

    function getBody(id){
        var item =getPopup(id);
        return item ? item.body :null;
    }

    function getTopId(){
        var item =getPopup();
        return item ? item.id :null;
    }

    function count(){
        return popupList.length;
    }

    function isOpen(){
        return popupList.length >0;
    }

    global.ymzPopupPage ={
        open:open,
        close:close,
        closeAll:closeAll,
        getBody:getBody,
        getTopId:getTopId,
        count:count,
        isOpen:isOpen
    };

})(window);

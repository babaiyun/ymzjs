/*! ymzImage v1.1.0 */
(function(global){
    'use strict';

    if(global.ymzImage) return;

    var base =global.ymzBase;
    if(!base) throw new Error('ymzBase is required');

    var sizeCache =typeof global.WeakMap !== 'undefined'
        ? new global.WeakMap()
        : null;

    function getImage(image){
        image =base.queryElem(image);

        return image &&
            image.tagName &&
            image.tagName.toLowerCase() === 'img'
            ? image
            : null;
    }

    function getAttrSize(image, name){
        var value =image.getAttribute(name);

        if(value == null || value === ''){
            return 0;
        }

        value =String(value).trim();

        // width/height HTML 属性只接受纯数字，避免把 100% / 20px 误当成像素值
        if(!/^\d+(?:\.\d+)?$/.test(value)){
            return 0;
        }

        value =Number(value);

        return isFinite(value) && value > 0
            ? value
            : 0;
    }

    function getCacheKey(image){
        return (
            image.currentSrc ||
            image.src ||
            ''
        ) + '|' +
            (image.getAttribute('width') || '') + '|' +
            (image.getAttribute('height') || '') + '|' +
            (image.naturalWidth || 0) + '|' +
            (image.naturalHeight || 0);
    }

    function createSize(width, height){
        return {
            width:width,
            height:height,
            ratio:width / height
        };
    }

    /**
     * 获取图片尺寸
     *
     * 优先级：
     * 1. HTML width + height
     * 2. 单边 HTML 尺寸 + 原图比例推导
     * 3. 图片 naturalWidth / naturalHeight
     * 4. 页面布局尺寸
     *
     * 布局尺寸可能随 CSS 实时变化，因此不进入缓存。
     */
    function getSize(image, allowLayoutSize){
        image =getImage(image);
        if(!image) return null;

        var cacheKey =getCacheKey(image),
            cached =sizeCache
                ? sizeCache.get(image)
                : null;

        if(cached && cached.key === cacheKey){
            return createSize(
                cached.width,
                cached.height
            );
        }

        var width =getAttrSize(image, 'width'),
            height =getAttrSize(image, 'height'),
            naturalWidth =image.naturalWidth || 0,
            naturalHeight =image.naturalHeight || 0;

        if(width > 0 && height > 0){
            if(sizeCache){
                sizeCache.set(image, {
                    key:cacheKey,
                    width:width,
                    height:height
                });
            }

            return createSize(width, height);
        }

        if(naturalWidth > 0 && naturalHeight > 0){
            if(width > 0){
                height =width * naturalHeight / naturalWidth;
            }else if(height > 0){
                width =height * naturalWidth / naturalHeight;
            }else{
                width =naturalWidth;
                height =naturalHeight;
            }

            if(sizeCache){
                sizeCache.set(image, {
                    key:cacheKey,
                    width:width,
                    height:height
                });
            }

            return createSize(width, height);
        }

        if(allowLayoutSize === false){
            return null;
        }

        width =image.offsetWidth;
        height =image.offsetHeight;

        if(!(width > 0 && height > 0)){
            return null;
        }

        return createSize(width, height);
    }

    function clearSize(image){
        image =getImage(image);
        if(!image) return false;

        if(sizeCache){
            sizeCache.delete(image);
        }

        return true;
    }

    function isImageReady(image){
        return !!(
            image &&
            image.complete &&
            image.naturalWidth > 0 &&
            image.naturalHeight > 0
        );
    }

    function isReady(image){
        return isImageReady(
            getImage(image)
        );
    }

    /**
     * 等待单张图片结束加载
     *
     * 加载失败也正常 resolve，
     * 这样批量等待不会被单张坏图中断。
     */
    function wait(image){
        image =getImage(image);

        if(!image){
            return Promise.resolve({
                image:null,
                loaded:false,
                size:null
            });
        }

        if(image.complete){
            clearSize(image);

            var ready =isImageReady(image);

            return Promise.resolve({
                image:image,
                loaded:ready,
                size:ready
                    ? getSize(image)
                    : null
            });
        }

        return new Promise(function(resolve){
            var finished =false;

            function done(loaded){
                if(finished) return;

                finished =true;

                image.removeEventListener(
                    'load',
                    onLoad,
                    false
                );

                image.removeEventListener(
                    'error',
                    onError,
                    false
                );

                clearSize(image);

                loaded =!!(
                    loaded &&
                    image.naturalWidth > 0 &&
                    image.naturalHeight > 0
                );

                resolve({
                    image:image,
                    loaded:loaded,
                    size:loaded
                        ? getSize(image)
                        : null
                });
            }

            function onLoad(){
                done(true);
            }

            function onError(){
                done(false);
            }

            image.addEventListener(
                'load',
                onLoad,
                false
            );

            image.addEventListener(
                'error',
                onError,
                false
            );

            /*
             * 绑定事件后再次检查 complete，
             * 避免图片恰好在首次检查与绑定事件之间完成而漏掉事件。
             */
            if(image.complete){
                done(isImageReady(image));
            }
        });
    }

    function normalizeImages(images, root){
        if(typeof images === 'string'){
            return base.queryAll(images, root);
        }

        if(
            images &&
            images.tagName &&
            images.tagName.toLowerCase() === 'img'
        ){
            return [images];
        }

        return base.toArray(images);
    }

    /**
     * 等待一组图片全部结束加载
     *
     * 返回结果顺序与传入顺序一致；
     * 单张失败不会导致整个 Promise reject。
     */
    function waitAll(images, root){
        var list =normalizeImages(images, root),
            tasks =[];

        for(var i=0,len=list.length; i<len; i++){
            tasks.push(
                wait(list[i])
            );
        }

        return Promise.all(tasks);
    }

    global.ymzImage ={
        getSize:getSize,
        clearSize:clearSize,
        isReady:isReady,
        wait:wait,
        waitAll:waitAll
    };

}(typeof globalThis !== 'undefined'
    ? globalThis
    : (typeof window !== 'undefined' ? window : this)));

/**
 * ymzLoader v1.0.0
 *
 * 传统 JavaScript 动态加载器
 *
 * 特点：
 * req() 支持单个 / 多个并行加载
 * ordreq() 支持严格顺序加载
 * callback 风格调用
 * 内部 Promise 协调异步状态
 * 同 URL 并发请求自动合并
 * 已存在全局类库自动复用
 * 支持多级全局标识
 * 加载失败后允许重新请求
 * 支持 URL / path / global flag 配置
 * debug 模式刷新页面自动更新 JS 版本
 */

(function(global){
    'use strict';

    if(global.ymzLoader) return;

    var configSource =global.ymzloaderConfigMap;
    var configMap =typeof configSource === 'function'
        ? configSource()
        : configSource;

    if(!configMap || typeof configMap !== 'object'){
        configMap ={};
    }

    var urlRoot =String(configMap.url_root || '/static/js/'),
        itemMap =configMap.item_map || {},
        timeout =Number(configMap.timeout) || 0,
        charset =configMap.charset || 'utf-8',
        debugMode =configMap.debug_mode === true,
        debugVersion =debugMode ? createDebugVersion() : '',
        loadedMap =Object.create(null),
        loadingMap =Object.create(null);

    if(urlRoot.charAt(urlRoot.length - 1) !== '/'){
        urlRoot +='/';
    }

    /**
     * 每次页面加载生成一个 debug 版本号
     *
     * 同一页面所有文件使用相同版本号，
     * 保证缓存失效的同时不影响加载去重。
     */
    function createDebugVersion(){
        return Date.now().toString(36) +
            Math.random().toString(36).slice(2, 8);
    }

    /**
     * 获取全局对象
     *
     * 支持：
     * ymzBase
     * adminTask.ipCheckUpdate
     * app.admin.task.run
     */
    function getGlobalValue(name){
        if(!name){
            return undefined;
        }

        name =String(name);

        // 大部分基础类库只有一级名称，直接读取减少不必要 split
        if(name.indexOf('.') === -1){
            return global[name];
        }

        var nameList =name.split('.'),
            value =global;

        for(var i=0,len=nameList.length; i<len; i++){
            if(value == null){
                return undefined;
            }

            value =value[nameList[i]];
        }

        return value;
    }

    /**
     * 添加 .js 后缀
     *
     * 支持：
     * abc
     * abc.js
     * abc?v=1
     * abc.js?v=1
     */
    function addJsExt(path){
        var index =path.search(/[?#]/),
            base,
            tail;

        if(index < 0){
            base =path;
            tail ='';
        }else{
            base =path.slice(0, index);
            tail =path.slice(index);
        }

        if(!/\.js$/i.test(base)){
            base +='.js';
        }

        return base + tail;
    }

    /**
     * debug 模式追加页面级版本号
     *
     * abc.js          -> abc.js?_ymzv=xxx
     * abc.js?a=1      -> abc.js?a=1&_ymzv=xxx
     * abc.js?a=1#box  -> abc.js?a=1&_ymzv=xxx#box
     */
    function addDebugVer(url){
        var hashIndex =url.indexOf('#'),
            base =hashIndex < 0
                ? url
                : url.slice(0, hashIndex),
            hash =hashIndex < 0
                ? ''
                : url.slice(hashIndex),
            version =encodeURIComponent(debugVersion);

        /*
         * 如果 URL 本身已经存在 _ymzv，
         * 直接替换，避免产生重复参数。
         */
        if(/([?&])_ymzv=[^&]*/.test(base)){
            base =base.replace(
                /([?&])_ymzv=[^&]*/,
                '$1_ymzv=' + version
            );

            return base + hash;
        }

        return base +
            (base.indexOf('?') < 0 ? '?' : '&') +
            '_ymzv=' +
            version +
            hash;
    }

    /**
     * 获取脚本配置
     *
     * item_map 示例：
     *
     * ymzDom:'base/ymzDom'
     *
     * 或：
     *
     * ymzDom:{
     *     path:'base/ymzDom',
     *     flag:'ymzDom'
     * }
     *
     * 或：
     *
     * ipCheckUpdate:{
     *     path:'admin/ipCheckUpdate',
     *     flag:'adminTask.ipCheckUpdate'
     * }
     *
     * 或：
     *
     * jquery:{
     *     url:'/static/vendor/jquery.min.js',
     *     flag:'jQuery'
     * }
     *
     * flag=false：
     * 不检查全局对象。
     */
    function resolveItem(name){
        if(typeof name !== 'string' || name === ''){
            throw new TypeError(
                '[ymzLoader] 脚本名称必须是非空字符串'
            );
        }

        var map =itemMap[name];

        if(typeof map === 'string'){
            map ={
                path:map
            };
        }else if(!map || typeof map !== 'object'){
            map ={};
        }

        var url,
            flag,
            debug = typeof map.debug === 'undefined' ? debugMode : map.debug;

        if(map.url){
            url =String(map.url);
        }else{
            url =urlRoot + addJsExt(
                String(map.path || name)
            );
        }

        if(debug){
            url =addDebugVer(url);
        }

        if(map.flag !== undefined){
            flag =map.flag;
        }else{
            flag =name;
        }

        return {
            name:name,
            url:url,
            flag:flag
        };
    }

    /**
     * 获取脚本执行后的返回值
     */
    function getResult(item){
        if(item.flag === false || item.flag == null){
            return true;
        }

        var value =getGlobalValue(item.flag);

        if(value === undefined){
            throw new Error(
                '[ymzLoader] 脚本已加载，但未找到全局对象 "' +
                item.flag +
                '": ' +
                item.url
            );
        }

        return value;
    }

    /**
     * 加载 URL
     */
    function loadUrl(url){
        if(loadedMap[url]){
            return Promise.resolve();
        }

        // 相同 URL 正在加载时共享 Promise，避免重复创建 script
        if(loadingMap[url]){
            return loadingMap[url];
        }

        var promise =new Promise(function(resolve, reject){
            var script =document.createElement('script'),
                timer =null,
                finished =false;

            function clean(){
                script.onload =null;
                script.onerror =null;

                if(timer !== null){
                    clearTimeout(timer);
                    timer =null;
                }
            }

            function success(){
                if(finished) return;

                finished =true;

                clean();

                delete loadingMap[url];
                loadedMap[url] =true;

                resolve();
            }

            function fail(error){
                if(finished) return;

                finished =true;

                clean();

                delete loadingMap[url];

                // 加载失败后删除节点，使后续请求可以重新加载
                if(script.parentNode){
                    script.parentNode.removeChild(script);
                }

                reject(error);
            }

            script.async =true;
            script.charset =charset;
            script.src =url;

            script.onload =success;

            script.onerror =function(){
                fail(
                    new Error(
                        '[ymzLoader] JS 加载失败: ' + url
                    )
                );
            };

            // timeout=0 表示关闭超时
            if(timeout > 0){
                timer =setTimeout(function(){
                    fail(
                        new Error(
                            '[ymzLoader] JS 加载超时(' +
                            timeout +
                            'ms): ' +
                            url
                        )
                    );
                }, timeout);
            }

            try{
                (document.head || document.documentElement)
                    .appendChild(script);
            }catch(error){
                fail(error);
            }
        });

        loadingMap[url] =promise;

        return promise;
    }

    /**
     * 加载单个类库
     */
    function loadOne(name){
        var item;

        try{
            item =resolveItem(name);
        }catch(error){
            return Promise.reject(error);
        }

        /*
         * 优先检查全局能力。
         *
         * 如果该类库已经：
         * - 被 HTML 提前加载
         * - 被其他 bundle 合并加载
         * - 被其他脚本提前初始化
         *
         * 都直接复用，不再请求单独 JS。
         */
        if(item.flag !== false && item.flag != null){
            var value =getGlobalValue(item.flag);

            if(value !== undefined){
                return Promise.resolve(value);
            }
        }

        return loadUrl(item.url).then(function(){
            return getResult(item);
        });
    }

    /**
     * callback 绑定
     *
     * 对外保持 callback 风格，
     * 同时保留 Promise 返回值供特殊场景使用。
     */
    function bindCallback(
        promise,
        isList,
        callback,
        errorCallback
    ){
        if(
            typeof callback !== 'function' &&
            typeof errorCallback !== 'function'
        ){
            return promise;
        }

        var callbackPromise =promise.then(
            function(result){
                if(typeof callback === 'function'){
                    if(isList){
                        callback.apply(global, result);
                    }else{
                        callback.call(global, result);
                    }
                }

                return result;
            },
            function(error){
                if(typeof errorCallback === 'function'){
                    errorCallback.call(global, error);
                }else if(
                    global.console &&
                    typeof global.console.error === 'function'
                ){
                    global.console.error(error);
                }
            }
        );

        // callback 自身异常单独记录，不改变原始加载 Promise
        callbackPromise.catch(function(error){
            if(
                global.console &&
                typeof global.console.error === 'function'
            ){
                global.console.error(
                    '[ymzLoader] callback 执行异常:',
                    error
                );
            }
        });

        return promise;
    }

    /**
     * 并行加载
     *
     * 单个：
     *
     * ymzLoader.req('ymzDom', function(dom){
     * });
     *
     * 多个：
     *
     * ymzLoader.req(
     *     ['ymzDom', 'ymzAjax'],
     *     function(dom, ajax){
     *     }
     * );
     */
    function req(names, callback, errorCallback){
        var isList =Array.isArray(names),
            list =isList ? names : [names];

        var promise =Promise.all(
            list.map(function(name){
                return loadOne(name);
            })
        );

        if(!isList){
            promise =promise.then(function(result){
                return result[0];
            });
        }

        return bindCallback(
            promise,
            isList,
            callback,
            errorCallback
        );
    }

    /**
     * 严格顺序加载
     *
     * a1 -> a2 -> a3 -> callback
     */
    function ordreq(names, callback, errorCallback){
        var isList =Array.isArray(names),
            list =isList ? names : [names],
            result =[],
            promise =Promise.resolve();

        for(var i=0,len=list.length; i<len; i++){
            (function(name){
                promise =promise.then(function(){
                    return loadOne(name);
                }).then(function(value){
                    result.push(value);
                });
            })(list[i]);
        }

        promise =promise.then(function(){
            return isList
                ? result
                : result[0];
        });

        return bindCallback(
            promise,
            isList,
            callback,
            errorCallback
        );
    }

    /**
     * 获取最终加载 URL
     *
     * debug 模式下包含当前页面版本参数。
     */
    function url(name){
        return resolveItem(name).url;
    }

    global.ymzLoader ={
        req:req,
        ordreq:ordreq,
        url:url
    };

})(typeof globalThis !== 'undefined'
    ? globalThis
    : (typeof window !== 'undefined' ? window : this));
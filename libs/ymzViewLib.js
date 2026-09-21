/*! ymzViewLib v1.0.0 */
(function(global){
    'use strict';

    if(global.ymzViewLib) return;

    var base =global.ymzBase;
    if(!base) throw new Error('ymzBase is required');

    var doc =base.getDoc(),
        _hasOwn =base.hasOwn,
        _newMap =base.newMap,
        _extend =base.extend,
        _consLog =base.consLog,
        _consErr =base.consErr,
        _escapeHTML =base.escapeHtml,
        _isArr =base.isArray || Array.isArray,
        _isArrayLike =base.isArrayLike,
        _isPlainObject =base.isPlainObject,
        _helpers =_newMap(),
        _def ={start:'<%',end:'%>',debug:0,maxDepth:32},
        _subNameRE =/^[A-Za-z0-9_.\/-]+$/;

    function _assertName(name, label){
        if(typeof name !== 'string' || name.trim() === ''){
            throw new TypeError(label + ' must be a non-empty string');
        }
    }

    function _isPositiveInt(value){
        return typeof value === 'number' &&
            isFinite(value) &&
            value >= 1 &&
            Math.floor(value) === value;
    }

    function _normalizeDebug(value){
        if(value === true) return 1;
        if(value === false || value == null || value === '') return 0;

        value =Number(value);
        if(!isFinite(value) || value < 0){
            throw new TypeError('debug must be a non-negative number or boolean');
        }

        return value;
    }

    function _countNL(str){
        var count =0,
            pos =-1;

        while((pos =str.indexOf('\n', pos + 1)) !== -1){
            count++;
        }

        return count;
    }

    function _lineText(tpl, line){
        if(!tpl || line < 1) return '';

        var cur =1,
            start =0,
            pos;

        while(cur < line){
            pos =tpl.indexOf('\n', start);
            if(pos === -1) return '';

            start =pos + 1;
            cur++;
        }

        pos =tpl.indexOf('\n', start);
        return tpl.slice(start, pos === -1 ? tpl.length : pos).trim();
    }

    function _makeSyntaxError(message, ckey, line, tpl){
        var key =ckey || '(inline)',
            text =_lineText(tpl, line),
            err;

        message ='[ymzViewLib] ' + message + ': ' + key + ' (line ' + line + ')';
        if(text) message +='\n> ' + text;

        err =new SyntaxError(message);
        err._ymzViewError =true;
        err.templateKey =ckey || '';
        err.templateLine =line;

        return err;
    }

    function _makeRenderError(error, ckey, line, tpl){
        if(error && error._ymzViewError) return error;

        var key =ckey || '(inline)',
            text =_lineText(tpl, line),
            name =error && error.name ? error.name : 'Error',
            msg,
            err;

        msg ='[ymzViewLib] render failed: ' + key + ' (line ' + line + ')';
        if(text) msg +='\n> ' + text;
        if(error && error.message) msg +='\n' + error.message;

        err =new Error(msg);
        err.name =name;
        err._ymzViewError =true;
        err.templateKey =ckey || '';
        err.templateLine =line;
        err.originalError =error || null;

        if(error && error.stack){
            try{
                err.stack =name + ': ' + msg + '\nCaused by: ' + error.stack;
            }catch(ignore){}
        }

        return err;
    }

    function _makeLookupError(message, ckey, chain){
        var err =new Error('[ymzViewLib] ' + message + (chain && chain.length ? '\nchain: ' + chain.join(' -> ') : ''));
        err._ymzViewError =true;
        err.templateKey =ckey || '';
        err.templateChain =chain ? chain.slice() : [];
        return err;
    }

    function _parseSub(code, ckey, line, tpl){
        code =code.trim();
        if(code === ''){
            throw _makeSyntaxError('subtemplate name cannot be empty', ckey, line, tpl);
        }

        var pos =code.indexOf(','),
            name,
            dataExpr;

        if(pos === -1){
            name =code;
            dataExpr ='d';
        }else{
            name =code.slice(0, pos).trim();
            dataExpr =code.slice(pos + 1).trim();

            if(dataExpr === ''){
                throw _makeSyntaxError('subtemplate data expression cannot be empty', ckey, line, tpl);
            }
        }

        if(!_subNameRE.test(name)){
            throw _makeSyntaxError('invalid subtemplate name "' + name + '"', ckey, line, tpl);
        }

        return {
            name:name,
            dataExpr:dataExpr
        };
    }

    function _tokenize(tpl, startTag, endTag, ckey){
        var list =[],
            pos =0,
            line =1,
            startPos,
            endPos,
            contentPos,
            flag,
            code,
            text,
            whole,
            tagLine;

        while((startPos =tpl.indexOf(startTag, pos)) !== -1){
            if(startPos > pos){
                text =tpl.slice(pos, startPos);
                list.push({type:'text',value:text,line:line});
                line +=_countNL(text);
            }

            tagLine =line;
            contentPos =startPos + startTag.length;
            flag =tpl.charAt(contentPos);

            if(flag === '=' || flag === '-' || flag === '#' || flag === '+'){
                contentPos++;
            }else{
                flag ='';
            }

            endPos =tpl.indexOf(endTag, contentPos);
            if(endPos === -1){
                throw _makeSyntaxError('unclosed template tag', ckey, tagLine, tpl);
            }

            code =tpl.slice(contentPos, endPos);
            list.push({type:'tag',flag:flag,code:code,line:tagLine});

            whole =tpl.slice(startPos, endPos + endTag.length);
            line +=_countNL(whole);
            pos =endPos + endTag.length;
        }

        if(pos < tpl.length){
            list.push({type:'text',value:tpl.slice(pos),line:line});
        }

        return list;
    }

    function _viewLib(p){
        if(p == null){
            p ={};
        }else if(!_isPlainObject(p)){
            throw new TypeError('options must be a plain object');
        }

        p =_extend(_extend({}, _def), p);

        _assertName(p.start, 'start');
        _assertName(p.end, 'end');

        if(p.start === p.end){
            throw new TypeError('start and end cannot be the same');
        }

        if(!_isPositiveInt(p.maxDepth)){
            throw new TypeError('maxDepth must be a positive integer');
        }

        p.debug =_normalizeDebug(p.debug);

        this.opt =p;
        this.cache =_newMap();
        this.tplMap =_newMap();
    }

    var _prot =_viewLib.prototype;

    /*
     * 模板语法：
     * <%= expr %> HTML 转义输出
     * <%- expr %> 原样输出
     * <% code %> JS 逻辑代码
     * <%# text %> 模板注释，编译时忽略
     * <%+ name %> 渲染子模板并继承当前数据
     * <%+ name, data %> 渲染子模板并传入指定数据
     */
    _prot.parse =function(tpl, ckey){
        var w =this,
            p =w.opt,
            tokens,
            source,
            cfun,
            i,
            token,
            code,
            sub,
            err;

        tpl =tpl == null ? '' : String(tpl);

        if(ckey != null && ckey !== ''){
            _assertName(ckey, 'cache key');
        }

        tokens =_tokenize(tpl, p.start, p.end, ckey || '');
        source ='"use strict";var tpls="",_v' + (p.debug ? ',_line=1' : '') + ';';

        if(p.debug){
            source +='try{';
        }

        for(i=0; i<tokens.length; i++){
            token =tokens[i];

            if(token.type === 'text'){
                if(token.value !== ''){
                    source +='tpls+=' + JSON.stringify(token.value) + ';';
                }
                continue;
            }

            if(token.flag === '#') continue;

            code =token.code.trim();
            if(token.flag === '' && code === '') continue;

            if((token.flag === '=' || token.flag === '-') && code === ''){
                throw _makeSyntaxError('output expression cannot be empty', ckey || '', token.line, tpl);
            }

            if(p.debug){
                source +='_line=' + token.line + ';';
            }

            if(token.flag === '='){
                source +='_v=(' + code + ');tpls+=(_v==null?"":_esc(_v));';
            }else if(token.flag === '-'){
                source +='_v=(' + code + ');tpls+=(_v==null?"":_v);';
            }else if(token.flag === '+'){
                sub =_parseSub(code, ckey || '', token.line, tpl);
                source +='tpls+=_sub(' + JSON.stringify(sub.name) + ',(' + sub.dataExpr + '));';
            }else{
                source +='\n' + code + '\n';
            }
        }

        if(p.debug){
            source +='}catch(e){throw _err(e,_line);}';
        }

        source +='return tpls;';

        try{
            cfun =new Function('d', 'h', '_esc', '_sub', '_err', source);
        }catch(e){
            if(p.debug){
                _consErr('[ymzViewLib] template compile failed' + (ckey ? ': ' + ckey : ''));
                _consLog(source);
            }

            err =new SyntaxError(
                '[ymzViewLib] template compile failed' +
                (ckey ? ': ' + ckey : ': (inline)') +
                (e && e.message ? '\n' + e.message : '')
            );
            err._ymzViewError =true;
            err.templateKey =ckey || '';
            err.originalError =e;

            if(p.debug){
                err.generatedSource =source;
            }

            throw err;
        }

        if(p.debug){
            cfun._ymzTpl =tpl;
            cfun._ymzKey =ckey || '';
        }

        if(ckey){
            w.cache[ckey] =cfun;
        }

        if(p.debug > 1){
            if(ckey){
                _consLog('[ymzViewLib] ckey: ' + ckey);
            }
            _consLog(cfun);
        }

        return cfun;
    };

    _prot._renderByKey =function(ckey, data, depth, chain){
        var w =this,
            cfun,
            tpl,
            oT;

        if(depth > w.opt.maxDepth){
            throw _makeLookupError(
                'max subtemplate depth exceeded (' + w.opt.maxDepth + ')',
                ckey,
                chain
            );
        }

        if(_hasOwn(w.cache, ckey)){
            cfun =w.cache[ckey];
        }else{
            if(_hasOwn(w.tplMap, ckey)){
                tpl =w.tplMap[ckey];
            }else{
                oT =doc ? doc.getElementById(ckey) : null;

                if(!oT){
                    throw _makeLookupError(
                        'template not found: ' + ckey,
                        ckey,
                        chain
                    );
                }

                tpl =oT.innerHTML;
            }

            cfun =w.parse(tpl, ckey);
        }

        return w._exec(cfun, ckey, data, depth, chain);
    };

    _prot._exec =function(cfun, ckey, data, depth, chain){
        var w =this,
            p =w.opt,
            renderData =data == null ? {} : data,
            tpl =p.debug ? (cfun._ymzTpl || '') : '';

        return cfun(
            renderData,
            _helpers,
            _escapeHTML,
            function(name, subData){
                return w._renderByKey(
                    name,
                    subData,
                    depth + 1,
                    chain.concat(name)
                );
            },
            p.debug ? function(error, line){
                return _makeRenderError(
                    error,
                    ckey || cfun._ymzKey || '',
                    line,
                    tpl
                );
            } : null
        );
    };

    /**
     * 渲染模板
     *
     * 查找顺序：显式 tpl → 编译缓存 → tplMap 注册模板 → DOM 模板
     */
    _prot.render =function(ckey, data, func, tpl){
        var w =this,
            cfun,
            html,
            key;

        if(func != null && typeof func !== 'function'){
            throw new TypeError('render callback must be a function');
        }

        if(tpl != null){
            key =ckey == null ? '' : ckey;

            if(key !== ''){
                _assertName(key, 'template key');
            }

            cfun =w.parse(tpl, key);
            html =w._exec(cfun, key, data, 0, [key || '(inline)']);
        }else{
            _assertName(ckey, 'template key');
            html =w._renderByKey(ckey, data, 0, [ckey]);
        }

        return func == null ? html : func(html, ckey);
    };

    _prot.tpl =function(name, tpl){
        _assertName(name, 'template name');

        if(typeof tpl !== 'string'){
            throw new TypeError('template must be a string');
        }

        this.tplMap[name] =tpl;
        return this.clearCache(name);
    };

    /**
     * 批量注册模板
     *
     * 先完整校验再写入，避免中途失败导致只注册部分数据
     */
    _prot.tplMany =function(list){
        if(!_isPlainObject(list)){
            throw new TypeError('template list must be a plain object');
        }

        var name;

        for(name in list){
            if(!_hasOwn(list, name)) continue;

            _assertName(name, 'template name');

            if(typeof list[name] !== 'string'){
                throw new TypeError('template must be a string: ' + name);
            }
        }

        for(name in list){
            if(!_hasOwn(list, name)) continue;

            this.tplMap[name] =list[name];

            if(_hasOwn(this.cache, name)){
                delete this.cache[name];
            }
        }

        return this;
    };

    _prot.hasTpl =function(name){
        return typeof name === 'string' &&
            name.trim() !== '' &&
            _hasOwn(this.tplMap, name);
    };

    _prot.hasCache =function(name){
        return typeof name === 'string' &&
            name.trim() !== '' &&
            _hasOwn(this.cache, name);
    };

    _prot.clearCache =function(name){
        if(name == null || name === ''){
            this.cache =_newMap();
            return this;
        }

        _assertName(name, 'cache key');

        if(_hasOwn(this.cache, name)){
            delete this.cache[name];
        }

        return this;
    };

    var api =global.ymzViewLib ={
        create:function(p){
            return new _viewLib(p);
        },

        /**
         * 遍历数组、ArrayLike 或普通对象
         * callback 返回 false 时立即停止
         */
        each:function(arr, func){
            if(typeof func !== 'function'){
                throw new TypeError('each callback must be a function');
            }

            if(arr == null) return;

            var i,
                len,
                name;

            if(_isArr(arr) || (_isArrayLike && _isArrayLike(arr))){
                for(i=0, len=arr.length; i<len; i++){
                    if(func(i, arr[i]) === false) break;
                }
                return;
            }

            for(name in arr){
                if(!_hasOwn(arr, name)) continue;
                if(func(name, arr[name]) === false) break;
            }
        },

        helperFunc:function(name, func){
            _assertName(name, 'helper name');

            if(typeof func !== 'function'){
                throw new TypeError('helper must be a function');
            }

            _helpers[name] =func;
            return api;
        },

        /**
         * 批量注册模板 Helper
         *
         * 先完整校验再写入，避免中途失败导致部分注册
         */
        helperList:function(list){
            if(!_isPlainObject(list)){
                throw new TypeError('helper list must be a plain object');
            }

            var name;

            for(name in list){
                if(!_hasOwn(list, name)) continue;

                _assertName(name, 'helper name');

                if(typeof list[name] !== 'function'){
                    throw new TypeError('helper must be a function: ' + name);
                }
            }

            for(name in list){
                if(_hasOwn(list, name)){
                    _helpers[name] =list[name];
                }
            }

            return api;
        },

        hasHelper:function(name){
            return typeof name === 'string' &&
                name.trim() !== '' &&
                _hasOwn(_helpers, name);
        }
    };

}(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this)));

/**
RhodeCode JS Files
**/

if (typeof console == "undefined" || typeof console.log == "undefined"){
	console = { log: function() {} }
}


var str_repeat = function(i, m) {
	for (var o = []; m > 0; o[--m] = i);
	return o.join('');
};

/**
 * INJECT .format function into String
 * Usage: "My name is {0} {1}".format("Johny","Bravo")
 * Return "My name is Johny Bravo"
 * Inspired by https://gist.github.com/1049426
 */
String.prototype.format = function() {
	  
	  function format() {
	    var str = this;
	    var len = arguments.length+1;
	    var safe = undefined;
	    var arg = undefined;
	    
	    // For each {0} {1} {n...} replace with the argument in that position.  If 
	    // the argument is an object or an array it will be stringified to JSON.
	    for (var i=0; i < len; arg = arguments[i++]) {
	      safe = typeof arg === 'object' ? JSON.stringify(arg) : arg;
	      str = str.replace(RegExp('\\{'+(i-1)+'\\}', 'g'), safe);
	    }
	    return str;
	  }

	  // Save a reference of what may already exist under the property native.  
	  // Allows for doing something like: if("".format.native) { /* use native */ }
	  format.native = String.prototype.format;

	  // Replace the prototype property
	  return format;

}();

String.prototype.strip = function(char) {
	if(char === undefined){
	    char = '\\s';
	}
	return this.replace(new RegExp('^'+char+'+|'+char+'+$','g'), '');
}
String.prototype.lstrip = function(char) {
	if(char === undefined){
	    char = '\\s';
	}
	return this.replace(new RegExp('^'+char+'+'),'');
}
String.prototype.rstrip = function(char) {
	if(char === undefined){
	    char = '\\s';
	}
	return this.replace(new RegExp(''+char+'+$'),'');
}


if(!Array.prototype.indexOf) {
    Array.prototype.indexOf = function(needle) {
        for(var i = 0; i < this.length; i++) {
            if(this[i] === needle) {
                return i;
            }
        }
        return -1;
    };
}

// IE(CRAP) doesn't support previousElementSibling
var prevElementSibling = function( el ) {
    if( el.previousElementSibling ) {
        return el.previousElementSibling;
    } else {
        while( el = el.previousSibling ) {
            if( el.nodeType === 1 ) return el;
        }
    }
}

var setSelectValue = function(select, val){
	var selection =  YUD.get(select);
	
    // select element
    for(var i=0;i<selection.options.length;i++){
        if (selection.options[i].innerHTML == val) {
            selection.selectedIndex = i;
            break;
        }
    }	
}


/**
 * SmartColorGenerator
 *
 *usage::
 *	var CG = new ColorGenerator();
 *  var col = CG.getColor(key); //returns array of RGB
 *  'rgb({0})'.format(col.join(',')
 * 
 * @returns {ColorGenerator}
 */
var ColorGenerator = function(){
	this.GOLDEN_RATIO = 0.618033988749895;
	this.CURRENT_RATIO = 0.22717784590367374 // this can be random
	this.HSV_1 = 0.75;//saturation
	this.HSV_2 = 0.95;
	this.color;
	this.cacheColorMap = {};
};

ColorGenerator.prototype = {
    getColor:function(key){
    	if(this.cacheColorMap[key] !== undefined){
    		return this.cacheColorMap[key];
    	}
    	else{
    		this.cacheColorMap[key] = this.generateColor();
    		return this.cacheColorMap[key];
    	}
    },
    _hsvToRgb:function(h,s,v){
        if (s == 0.0)
            return [v, v, v];
        i = parseInt(h * 6.0)
        f = (h * 6.0) - i
        p = v * (1.0 - s)
        q = v * (1.0 - s * f)
        t = v * (1.0 - s * (1.0 - f))
        i = i % 6
        if (i == 0) 
            return [v, t, p]
        if (i == 1) 
            return [q, v, p]
        if (i == 2) 
            return [p, v, t]
        if (i == 3)
            return [p, q, v]
        if (i == 4) 
            return [t, p, v]
        if (i == 5)
            return [v, p, q]            	
    },
    generateColor:function(){
        this.CURRENT_RATIO = this.CURRENT_RATIO+this.GOLDEN_RATIO;
        this.CURRENT_RATIO = this.CURRENT_RATIO %= 1;
        HSV_tuple = [this.CURRENT_RATIO, this.HSV_1, this.HSV_2]
        RGB_tuple = this._hsvToRgb(HSV_tuple[0],HSV_tuple[1],HSV_tuple[2]);
        function toRgb(v){
        	return ""+parseInt(v*256)
        }
        return [toRgb(RGB_tuple[0]),toRgb(RGB_tuple[1]),toRgb(RGB_tuple[2])];
        
    }
}





/**
 * GLOBAL YUI Shortcuts
 */
var YUC = YAHOO.util.Connect;
var YUD = YAHOO.util.Dom;
var YUE = YAHOO.util.Event;
var YUQ = YAHOO.util.Selector.query;

// defines if push state is enabled for this browser ?
var push_state_enabled = Boolean(
		window.history && window.history.pushState && window.history.replaceState
		&& !(   /* disable for versions of iOS before version 4.3 (8F190) */
				(/ Mobile\/([1-7][a-z]|(8([abcde]|f(1[0-8]))))/i).test(navigator.userAgent)
				/* disable for the mercury iOS browser, or at least older versions of the webkit engine */
				|| (/AppleWebKit\/5([0-2]|3[0-2])/i).test(navigator.userAgent)
		)
);

var _run_callbacks = function(callbacks){
	if (callbacks !== undefined){
		var _l = callbacks.length;
	    for (var i=0;i<_l;i++){
	    	var func = callbacks[i];
	    	if(typeof(func)=='function'){
	            try{
	          	    func();
	            }catch (err){};            		
	    	}
	    }
	}		
}

/**
 * Partial Ajax Implementation
 * 
 * @param url: defines url to make partial request
 * @param container: defines id of container to input partial result
 * @param s_call: success callback function that takes o as arg
 *  o.tId
 *  o.status
 *  o.statusText
 *  o.getResponseHeader[ ]
 *  o.getAllResponseHeaders
 *  o.responseText
 *  o.responseXML
 *  o.argument
 * @param f_call: failure callback
 * @param args arguments 
 */
function ypjax(url,container,s_call,f_call,args){
	var method='GET';
	if(args===undefined){
		args=null;
	}
	
	// Set special header for partial ajax == HTTP_X_PARTIAL_XHR
	YUC.initHeader('X-PARTIAL-XHR',true);
	
	// wrapper of passed callback
	var s_wrapper = (function(o){
		return function(o){
			YUD.get(container).innerHTML=o.responseText;
			YUD.setStyle(container,'opacity','1.0');
    		//execute the given original callback
    		if (s_call !== undefined){
    			s_call(o);
    		}
		}
	})()	
	YUD.setStyle(container,'opacity','0.3');
	YUC.asyncRequest(method,url,{
		success:s_wrapper,
		failure:function(o){
			console.log(o);
			YUD.get(container).innerHTML='<span class="error_red">ERROR: {0}</span>'.format(o.status);
			YUD.setStyle(container,'opacity','1.0');
		},
		cache:false
	},args);
	
};

var ajaxGET = function(url,success) {
	// Set special header for ajax == HTTP_X_PARTIAL_XHR
	YUC.initHeader('X-PARTIAL-XHR',true);

    var sUrl = url;
    var callback = {
        success: success,
        failure: function (o) {
            alert("error");
        },
    };

    var request = YAHOO.util.Connect.asyncRequest('GET', sUrl, callback);
    return request;
};



var ajaxPOST = function(url,postData,success) {
	// Set special header for ajax == HTTP_X_PARTIAL_XHR
	YUC.initHeader('X-PARTIAL-XHR',true);
	
	var toQueryString = function(o) {
	    if(typeof o !== 'object') {
	        return false;
	    }
	    var _p, _qs = [];
	    for(_p in o) {
	        _qs.push(encodeURIComponent(_p) + '=' + encodeURIComponent(o[_p]));
	    }
	    return _qs.join('&');
	};
	
    var sUrl = url;
    var callback = {
        success: success,
        failure: function (o) {
            alert("error");
        },
    };
    var postData = toQueryString(postData);
    var request = YAHOO.util.Connect.asyncRequest('POST', sUrl, callback, postData);
    return request;
};


/**
 * tooltip activate
 */
var tooltip_activate = function(){
	yt = YAHOO.yuitip.main;
	YUE.onDOMReady(yt.init);
};

/**
 * show more
 */
var show_more_event = function(){
    YUE.on(YUD.getElementsByClassName('show_more'),'click',function(e){
        var el = e.target;
        YUD.setStyle(YUD.get(el.id.substring(1)),'display','');
        YUD.setStyle(el.parentNode,'display','none');
    });
};

/**
 * show changeset tooltip
 */
var show_changeset_tooltip = function(){
	YUE.on(YUD.getElementsByClassName('lazy-cs'), 'mouseover', function(e){
		var target = e.currentTarget;
		var rid = YUD.getAttribute(target,'raw_id');
		var repo_name = YUD.getAttribute(target,'repo_name');
		var ttid = 'tt-'+rid;
		var success = function(o){
			var json = JSON.parse(o.responseText);
			YUD.addClass(target,'tooltip')
			YUD.setAttribute(target, 'title',json['message']);
			YAHOO.yuitip.main.show_yuitip(e, target);
		}
		if(rid && !YUD.hasClass(target, 'tooltip')){
			YUD.setAttribute(target,'id',ttid);
			YUD.setAttribute(target, 'title',_TM['loading...']);
			YAHOO.yuitip.main.set_listeners(target);
			YAHOO.yuitip.main.show_yuitip(e, target);			
			ajaxGET('/changeset_info/{0}/{1}'.format(repo_name,rid), success)
		}
	});
};

var onSuccessFollow = function(target){
    var f = YUD.get(target.id);
    var f_cnt = YUD.get('current_followers_count');

    if(YUD.hasClass(f, 'follow')){
        f.setAttribute('class','following');
        f.setAttribute('title',_TM['Stop following this repository']);

        if(f_cnt){
            var cnt = Number(f_cnt.innerHTML)+1;
            f_cnt.innerHTML = cnt;
        }
    }
    else{
        f.setAttribute('class','follow');
        f.setAttribute('title',_TM['Start following this repository']);
        if(f_cnt){
            var cnt = Number(f_cnt.innerHTML)-1;
            f_cnt.innerHTML = cnt;
        }
    }
}

var toggleFollowingUser = function(target,fallows_user_id,token,user_id){
    args = 'follows_user_id='+fallows_user_id;
    args+= '&amp;auth_token='+token;
    if(user_id != undefined){
        args+="&amp;user_id="+user_id;
    }
    YUC.asyncRequest('POST',TOGGLE_FOLLOW_URL,{
        success:function(o){
        	onSuccessFollow(target);
        }
    },args);
    return false;
}

var toggleFollowingRepo = function(target,fallows_repo_id,token,user_id){

    args = 'follows_repo_id='+fallows_repo_id;
    args+= '&amp;auth_token='+token;
    if(user_id != undefined){
        args+="&amp;user_id="+user_id;
    }
    YUC.asyncRequest('POST',TOGGLE_FOLLOW_URL,{
        success:function(o){
        	onSuccessFollow(target);
        }
    },args);
    return false;
}


/**
 * TOOLTIP IMPL.
 */
YAHOO.namespace('yuitip');
YAHOO.yuitip.main = {

	$:			YAHOO.util.Dom.get,

	bgColor:	'#000',
	speed:		0.3,
	opacity:	0.9,
	offset:		[15,15],
	useAnim:	false,
	maxWidth:	600,
	add_links:	false,
	yuitips:    [],

	set_listeners: function(tt){
		YUE.on(tt, 'mouseover', yt.show_yuitip,  tt);
		YUE.on(tt, 'mousemove', yt.move_yuitip,  tt);
		YUE.on(tt, 'mouseout',  yt.close_yuitip, tt);		
	},

	init: function(){
		yt._tooltip = '';
		yt.tipBox = yt.$('tip-box');
		if(!yt.tipBox){
			yt.tipBox = document.createElement('div');
			document.body.appendChild(yt.tipBox);
			yt.tipBox.id = 'tip-box';
		}

		YUD.setStyle(yt.tipBox, 'display', 'none');
		YUD.setStyle(yt.tipBox, 'position', 'absolute');
		if(yt.maxWidth !== null){
			YUD.setStyle(yt.tipBox, 'max-width', yt.maxWidth+'px');
		}

		var yuitips = YUD.getElementsByClassName('tooltip');

		if(yt.add_links === true){
			var links = document.getElementsByTagName('a');
			var linkLen = links.length;
			for(i=0;i<linkLen;i++){
				yuitips.push(links[i]);
			}
		}

		var yuiLen = yuitips.length;

		for(i=0;i<yuiLen;i++){
			yt.set_listeners(yuitips[i]);
		}
	},

	show_yuitip: function(e, el){
		YUE.stopEvent(e);
		if(el.tagName.toLowerCase() === 'img'){
			yt.tipText = el.alt ? el.alt : '';
		} else {
			yt.tipText = el.title ? el.title : '';
		}

		if(yt.tipText !== ''){
			// save org title
			yt._tooltip = yt.tipText;
			// reset title to not show org tooltips
			YUD.setAttribute(el, 'title', '');

			yt.tipBox.innerHTML = yt.tipText;
			YUD.setStyle(yt.tipBox, 'display', 'block');
			if(yt.useAnim === true){
				YUD.setStyle(yt.tipBox, 'opacity', '0');
				var newAnim = new YAHOO.util.Anim(yt.tipBox,
					{
						opacity: { to: yt.opacity }
					}, yt.speed, YAHOO.util.Easing.easeOut
				);
				newAnim.animate();
			}
		}
	},

	move_yuitip: function(e, el){
		YUE.stopEvent(e);
		var movePos = YUE.getXY(e);
		YUD.setStyle(yt.tipBox, 'top', (movePos[1] + yt.offset[1]) + 'px');
		YUD.setStyle(yt.tipBox, 'left', (movePos[0] + yt.offset[0]) + 'px');
	},

	close_yuitip: function(e, el){
		YUE.stopEvent(e);
	
		if(yt.useAnim === true){
			var newAnim = new YAHOO.util.Anim(yt.tipBox,
				{
					opacity: { to: 0 }
				}, yt.speed, YAHOO.util.Easing.easeOut
			);
			newAnim.animate();
		} else {
			YUD.setStyle(yt.tipBox, 'display', 'none');
		}
		YUD.setAttribute(el,'title', yt._tooltip);
	}
}

/**
 * Quick filter widget
 * 
 * @param target: filter input target
 * @param nodes: list of nodes in html we want to filter.
 * @param display_element function that takes current node from nodes and
 *    does hide or show based on the node
 * 
 */
var q_filter = function(target,nodes,display_element){
	
	var nodes = nodes;
	var q_filter_field = YUD.get(target);
	var F = YAHOO.namespace(target);

	YUE.on(q_filter_field,'click',function(){
	   q_filter_field.value = '';
	});

	YUE.on(q_filter_field,'keyup',function(e){
	    clearTimeout(F.filterTimeout); 
	    F.filterTimeout = setTimeout(F.updateFilter,600); 
	});

	F.filterTimeout = null;

	var show_node = function(node){
		YUD.setStyle(node,'display','')
	}
	var hide_node = function(node){
		YUD.setStyle(node,'display','none');
	}
	
	F.updateFilter  = function() { 
	   // Reset timeout 
	   F.filterTimeout = null;
	   
	   var obsolete = [];
	   
	   var req = q_filter_field.value.toLowerCase();
	   
	   var l = nodes.length;
	   var i;
	   var showing = 0;
	   
       for (i=0;i<l;i++ ){
    	   var n = nodes[i];
    	   var target_element = display_element(n)
    	   if(req && n.innerHTML.toLowerCase().indexOf(req) == -1){
    		   hide_node(target_element);
    	   }
    	   else{
    		   show_node(target_element);
    		   showing+=1;
    	   }
       }	  	   

	   // if repo_count is set update the number
	   var cnt = YUD.get('repo_count');
	   if(cnt){
		   YUD.get('repo_count').innerHTML = showing;
	   }       
       
	}	
};

var tableTr = function(cls, body){
	var _el = document.createElement('div');
	var cont = new YAHOO.util.Element(body);
	var comment_id = fromHTML(body).children[0].id.split('comment-')[1];
	var id = 'comment-tr-{0}'.format(comment_id);
	var _html = ('<table><tbody><tr id="{0}" class="{1}">'+
	              '<td class="lineno-inline new-inline"></td>'+
    			  '<td class="lineno-inline old-inline"></td>'+ 
                  '<td>{2}</td>'+
                 '</tr></tbody></table>').format(id, cls, body);
	_el.innerHTML = _html;
	return _el.children[0].children[0].children[0];
};

/** comments **/
var removeInlineForm = function(form) {
	form.parentNode.removeChild(form);
};

var createInlineForm = function(parent_tr, f_path, line) {
	var tmpl = YUD.get('comment-inline-form-template').innerHTML;
	tmpl = tmpl.format(f_path, line);
	var form = tableTr('comment-form-inline',tmpl)

	// create event for hide button
	form = new YAHOO.util.Element(form);
	var form_hide_button = new YAHOO.util.Element(YUD.getElementsByClassName('hide-inline-form',null,form)[0]);
	form_hide_button.on('click', function(e) {
		var newtr = e.currentTarget.parentNode.parentNode.parentNode.parentNode.parentNode;
		if(YUD.hasClass(newtr.nextElementSibling,'inline-comments-button')){
			YUD.setStyle(newtr.nextElementSibling,'display','');
		}
		removeInlineForm(newtr);
		YUD.removeClass(parent_tr, 'form-open');
		YUD.removeClass(parent_tr, 'hl-comment');
		
	});
	
	return form
};

/**
 * Inject inline comment for on given TR this tr should be always an .line
 * tr containing the line. Code will detect comment, and always put the comment
 * block at the very bottom
 */
var injectInlineForm = function(tr){
	  if(!YUD.hasClass(tr, 'line')){
		  return
	  }
	  var submit_url = AJAX_COMMENT_URL;
	  var _td = YUD.getElementsByClassName('code',null,tr)[0];
	  if(YUD.hasClass(tr,'form-open') || YUD.hasClass(tr,'context') || YUD.hasClass(_td,'no-comment')){
		  return
	  }	
	  YUD.addClass(tr,'form-open');
	  YUD.addClass(tr,'hl-comment');
	  var node = YUD.getElementsByClassName('full_f_path',null,tr.parentNode.parentNode.parentNode)[0];
	  var f_path = YUD.getAttribute(node,'path');
	  var lineno = getLineNo(tr);
	  var form = createInlineForm(tr, f_path, lineno, submit_url);
	  
	  var parent = tr;
	  while (1){
		  var n = parent.nextElementSibling;
		  // next element are comments !
		  if(YUD.hasClass(n,'inline-comments')){
			  parent = n;
		  }
		  else{
			  break;
		  }
	  }	  
	  YUD.insertAfter(form,parent);
	  var f = YUD.get(form);
	  var overlay = YUD.getElementsByClassName('overlay',null,f)[0];
	  var _form = YUD.getElementsByClassName('inline-form',null,f)[0];
	  
	  YUE.on(YUD.get(_form), 'submit',function(e){
		  YUE.preventDefault(e);
		  
		  //ajax submit
		  var text = YUD.get('text_'+lineno).value;
		  var postData = {
	            'text':text,
	            'f_path':f_path,
	            'line':lineno
		  };
		  
		  if(lineno === undefined){
			  alert('missing line !');
			  return
		  }
		  if(f_path === undefined){
			  alert('missing file path !');
			  return
		  }
		  
		  if(text == ""){
			  return
		  }
		  
		  var success = function(o){
			  YUD.removeClass(tr, 'form-open');
			  removeInlineForm(f);			  
			  var json_data = JSON.parse(o.responseText);
	          renderInlineComment(json_data);
		  };

		  if (YUD.hasClass(overlay,'overlay')){
			  var w = _form.offsetWidth;
			  var h = _form.offsetHeight;
			  YUD.setStyle(overlay,'width',w+'px');
			  YUD.setStyle(overlay,'height',h+'px');
		  }		  
		  YUD.addClass(overlay, 'submitting');		  
		  
		  ajaxPOST(submit_url, postData, success);
	  });
	  
	  setTimeout(function(){
		  // callbacks
		  tooltip_activate();
		  MentionsAutoComplete('text_'+lineno, 'mentions_container_'+lineno, 
	                         _USERS_AC_DATA, _GROUPS_AC_DATA);
		  var _e = YUD.get('text_'+lineno);
		  if(_e){
			  _e.focus();
		  }
	  },10)
};

var deleteComment = function(comment_id){
	var url = AJAX_COMMENT_DELETE_URL.replace('__COMMENT_ID__',comment_id);
    var postData = {'_method':'delete'};
    var success = function(o){
        var n = YUD.get('comment-tr-'+comment_id);
        var root = prevElementSibling(prevElementSibling(n));
        n.parentNode.removeChild(n);

        // scann nodes, and attach add button to last one
        placeAddButton(root);
    }
    ajaxPOST(url,postData,success);
}

var updateReviewers = function(reviewers_ids){
	if (reviewers_ids === undefined){
  	  var reviewers_ids = [];
	  var ids = YUQ('#review_members input');
	  for(var i=0; i<ids.length;i++){
		  var id = ids[i].value
		  reviewers_ids.push(id);
	  }		
	}
	var url = AJAX_UPDATE_PULLREQUEST;
	var postData = {'_method':'put',
			        'reviewers_ids': reviewers_ids};
	var success = function(o){
		window.location.reload();
	}
	ajaxPOST(url,postData,success);
}

var createInlineAddButton = function(tr){

	var label = TRANSLATION_MAP['add another comment'];
	
	var html_el = document.createElement('div');
	YUD.addClass(html_el, 'add-comment');
	html_el.innerHTML = '<span class="ui-btn">{0}</span>'.format(label);
	
	var add = new YAHOO.util.Element(html_el);
	add.on('click', function(e) {
		injectInlineForm(tr);
	});
	return add;
};

var getLineNo = function(tr) {
	var line;
	var o = tr.children[0].id.split('_');
	var n = tr.children[1].id.split('_');

	if (n.length >= 2) {
		line = n[n.length-1];
	} else if (o.length >= 2) {
		line = o[o.length-1];
	}

	return line
};

var placeAddButton = function(target_tr){
	if(!target_tr){
		return
	}
	var last_node = target_tr;
    //scann	
	  while (1){
		  var n = last_node.nextElementSibling;
		  // next element are comments !
		  if(YUD.hasClass(n,'inline-comments')){
			  last_node = n;
			  //also remove the comment button from previous
			  var comment_add_buttons = YUD.getElementsByClassName('add-comment',null,last_node);
			  for(var i=0;i<comment_add_buttons.length;i++){
				  var b = comment_add_buttons[i];
				  b.parentNode.removeChild(b);
			  }
		  }
		  else{
			  break;
		  }
	  }
	  
    var add = createInlineAddButton(target_tr);
    // get the comment div
    var comment_block = YUD.getElementsByClassName('comment',null,last_node)[0];
    // attach add button
    YUD.insertAfter(add,comment_block);	
}

/**
 * Places the inline comment into the changeset block in proper line position
 */
var placeInline = function(target_container,lineno,html){
	  var lineid = "{0}_{1}".format(target_container,lineno);
	  var target_line = YUD.get(lineid);
	  var comment = new YAHOO.util.Element(tableTr('inline-comments',html))
	  
	  // check if there are comments already !
	  var parent = target_line.parentNode;
	  var root_parent = parent;
	  while (1){
		  var n = parent.nextElementSibling;
		  // next element are comments !
		  if(YUD.hasClass(n,'inline-comments')){
			  parent = n;
		  }
		  else{
			  break;
		  }
	  }
	  // put in the comment at the bottom
	  YUD.insertAfter(comment,parent);
	  
	  // scann nodes, and attach add button to last one
      placeAddButton(root_parent);

	  return target_line;
}

/**
 * make a single inline comment and place it inside
 */
var renderInlineComment = function(json_data){
    try{
	  var html =  json_data['rendered_text'];
	  var lineno = json_data['line_no'];
	  var target_id = json_data['target_id'];
	  placeInline(target_id, lineno, html);

    }catch(e){
  	  console.log(e);
    }
}

/**
 * Iterates over all the inlines, and places them inside proper blocks of data
 */
var renderInlineComments = function(file_comments){
	for (f in file_comments){
        // holding all comments for a FILE
		var box = file_comments[f];

		var target_id = YUD.getAttribute(box,'target_id');
		// actually comments with line numbers
        var comments = box.children;
        for(var i=0; i<comments.length; i++){
        	var data = {
        		'rendered_text': comments[i].outerHTML,
        		'line_no': YUD.getAttribute(comments[i],'line'),
        		'target_id': target_id
        	}
        	renderInlineComment(data);
        }
    }	
}

var removeReviewer = function(reviewer_id){
	var el = YUD.get('reviewer_{0}'.format(reviewer_id));
	if (el.parentNode !== undefined){
		el.parentNode.removeChild(el);
	}
	updateReviewers();
}

var fileBrowserListeners = function(current_url, node_list_url, url_base){
	var current_url_branch = +"?branch=__BRANCH__";

	YUE.on('stay_at_branch','click',function(e){
	    if(e.target.checked){
	        var uri = current_url_branch;
	        uri = uri.replace('__BRANCH__',e.target.value);
	        window.location = uri;
	    }
	    else{
	        window.location = current_url;
	    }
	})            

	var n_filter = YUD.get('node_filter');
	var F = YAHOO.namespace('node_filter');
	
	F.filterTimeout = null;
	var nodes = null;

	F.initFilter = function(){
	  YUD.setStyle('node_filter_box_loading','display','');
	  YUD.setStyle('search_activate_id','display','none');
	  YUD.setStyle('add_node_id','display','none');
	  YUC.initHeader('X-PARTIAL-XHR',true);
	  YUC.asyncRequest('GET', node_list_url, {
	      success:function(o){
	        nodes = JSON.parse(o.responseText).nodes;
	        YUD.setStyle('node_filter_box_loading','display','none');
	        YUD.setStyle('node_filter_box','display','');
	        n_filter.focus();
			if(YUD.hasClass(n_filter,'init')){
				n_filter.value = '';
				YUD.removeClass(n_filter,'init');
			}   
	      },
	      failure:function(o){
	          console.log('failed to load');
	      }
	  },null);            
	}

	F.updateFilter  = function(e) {
	    
	    return function(){
	        // Reset timeout 
	        F.filterTimeout = null;
	        var query = e.target.value.toLowerCase();
	        var match = [];
	        var matches = 0;
	        var matches_max = 20;
	        if (query != ""){
	            for(var i=0;i<nodes.length;i++){
	            	
	                var pos = nodes[i].name.toLowerCase().indexOf(query)
	                if(query && pos != -1){
	                    
	                    matches++
	                    //show only certain amount to not kill browser 
	                    if (matches > matches_max){
	                        break;
	                    }
	                    
	                    var n = nodes[i].name;
	                    var t = nodes[i].type;
	                    var n_hl = n.substring(0,pos)
	                      +"<b>{0}</b>".format(n.substring(pos,pos+query.length))
	                      +n.substring(pos+query.length)
	                    var new_url = url_base.replace('__FPATH__',n);
	                    match.push('<tr><td><a class="browser-{0}" href="{1}">{2}</a></td><td colspan="5"></td></tr>'.format(t,new_url,n_hl));
	                }
	                if(match.length >= matches_max){
	                    match.push('<tr><td>{0}</td><td colspan="5"></td></tr>'.format(_TM['search truncated']));
	                }
	            }                       
	        }
	        if(query != ""){
	            YUD.setStyle('tbody','display','none');
	            YUD.setStyle('tbody_filtered','display','');
	            
	            if (match.length==0){
	              match.push('<tr><td>{0}</td><td colspan="5"></td></tr>'.format(_TM['no matching files']));
	            }                           
	            
	            YUD.get('tbody_filtered').innerHTML = match.join("");   
	        }
	        else{
	            YUD.setStyle('tbody','display','');
	            YUD.setStyle('tbody_filtered','display','none');
	        }
	        
	    }
	};

	YUE.on(YUD.get('filter_activate'),'click',function(){
	    F.initFilter();
	})
	YUE.on(n_filter,'click',function(){
		if(YUD.hasClass(n_filter,'init')){
			n_filter.value = '';
			YUD.removeClass(n_filter,'init');
		}
	 });
	YUE.on(n_filter,'keyup',function(e){
	    clearTimeout(F.filterTimeout); 
	    F.filterTimeout = setTimeout(F.updateFilter(e),600);
	});
};


var initCodeMirror = function(textAreadId,resetUrl){  
    var myCodeMirror = CodeMirror.fromTextArea(YUD.get(textAreadId),{
           mode:  "null",
           lineNumbers:true
         });
    YUE.on('reset','click',function(e){
        window.location=resetUrl
    });
    
    YUE.on('file_enable','click',function(){
        YUD.setStyle('editor_container','display','');
        YUD.setStyle('upload_file_container','display','none');
        YUD.setStyle('filename_container','display','');
    });
    
    YUE.on('upload_file_enable','click',function(){
        YUD.setStyle('editor_container','display','none');
        YUD.setStyle('upload_file_container','display','');
        YUD.setStyle('filename_container','display','none');
    });	
};



var getIdentNode = function(n){
	//iterate thru nodes untill matched interesting node !
	
	if (typeof n == 'undefined'){
		return -1
	}
	
	if(typeof n.id != "undefined" && n.id.match('L[0-9]+')){
			return n
		}
	else{
		return getIdentNode(n.parentNode);
	}
};

var  getSelectionLink = function(e) {

	//get selection from start/to nodes    	
	if (typeof window.getSelection != "undefined") {
		s = window.getSelection();
	
	   	from = getIdentNode(s.anchorNode);
	   	till = getIdentNode(s.focusNode);
	   	
	    f_int = parseInt(from.id.replace('L',''));
	    t_int = parseInt(till.id.replace('L',''));
	    
	    if (f_int > t_int){
	    	//highlight from bottom 
	    	offset = -35;
	    	ranges = [t_int,f_int];
	    	
	    }
	    else{
	    	//highligth from top 
	    	offset = 35;
	    	ranges = [f_int,t_int];
	    }
	    // if we select more than 2 lines
	    if (ranges[0] != ranges[1]){
	        if(YUD.get('linktt') == null){
	            hl_div = document.createElement('div');
	            hl_div.id = 'linktt';
	        }
	        hl_div.innerHTML = '';

	        anchor = '#L'+ranges[0]+'-'+ranges[1];
	        var link = document.createElement('a');
	        link.href = location.href.substring(0,location.href.indexOf('#'))+anchor;
	        link.innerHTML = _TM['Selection link'];
	        hl_div.appendChild(link);
	        YUD.get('body').appendChild(hl_div);
	        
	        xy = YUD.getXY(till.id);

	        YUD.addClass('linktt', 'hl-tip-box');
	        YUD.setStyle('linktt','top',xy[1]+offset+'px');
	        YUD.setStyle('linktt','left',xy[0]+'px');
	        YUD.setStyle('linktt','visibility','visible');

	    }
	    else{
	    	YUD.setStyle('linktt','visibility','hidden');
	    }
	}
};

var deleteNotification = function(url, notification_id,callbacks){
    var callback = { 
		success:function(o){
		    var obj = YUD.get(String("notification_"+notification_id));
		    if(obj.parentNode !== undefined){
				obj.parentNode.removeChild(obj);
			}
			_run_callbacks(callbacks);
		},
	    failure:function(o){
	        alert("error");
	    },
	};
    var postData = '_method=delete';
    var sUrl = url.replace('__NOTIFICATION_ID__',notification_id);
    var request = YAHOO.util.Connect.asyncRequest('POST', sUrl, 
    											  callback, postData);
};	

var readNotification = function(url, notification_id,callbacks){
    var callback = { 
		success:function(o){
		    var obj = YUD.get(String("notification_"+notification_id));
		    YUD.removeClass(obj, 'unread');
		    var r_button = YUD.getElementsByClassName('read-notification',null,obj.children[0])[0];
		    
		    if(r_button.parentNode !== undefined){
		    	r_button.parentNode.removeChild(r_button);
			}		    
			_run_callbacks(callbacks);
		},
	    failure:function(o){
	        alert("error");
	    },
	};
    var postData = '_method=put';
    var sUrl = url.replace('__NOTIFICATION_ID__',notification_id);
    var request = YAHOO.util.Connect.asyncRequest('POST', sUrl, 
    											  callback, postData);
};	

/** MEMBERS AUTOCOMPLETE WIDGET **/

var MembersAutoComplete = function (divid, cont, users_list, groups_list) {
    var myUsers = users_list;
    var myGroups = groups_list;

    // Define a custom search function for the DataSource of users
    var matchUsers = function (sQuery) {
            // Case insensitive matching
            var query = sQuery.toLowerCase();
            var i = 0;
            var l = myUsers.length;
            var matches = [];

            // Match against each name of each contact
            for (; i < l; i++) {
                contact = myUsers[i];
                if (((contact.fname+"").toLowerCase().indexOf(query) > -1) || 
                   	 ((contact.lname+"").toLowerCase().indexOf(query) > -1) || 
                   	 ((contact.nname) && ((contact.nname).toLowerCase().indexOf(query) > -1))) {
                       matches[matches.length] = contact;
                   }
            }
            return matches;
        };

    // Define a custom search function for the DataSource of usersGroups
    var matchGroups = function (sQuery) {
            // Case insensitive matching
            var query = sQuery.toLowerCase();
            var i = 0;
            var l = myGroups.length;
            var matches = [];

            // Match against each name of each contact
            for (; i < l; i++) {
                matched_group = myGroups[i];
                if (matched_group.grname.toLowerCase().indexOf(query) > -1) {
                    matches[matches.length] = matched_group;
                }
            }
            return matches;
        };

    //match all
    var matchAll = function (sQuery) {
            u = matchUsers(sQuery);
            g = matchGroups(sQuery);
            return u.concat(g);
        };

    // DataScheme for members
    var memberDS = new YAHOO.util.FunctionDataSource(matchAll);
    memberDS.responseSchema = {
        fields: ["id", "fname", "lname", "nname", "grname", "grmembers", "gravatar_lnk"]
    };

    // DataScheme for owner
    var ownerDS = new YAHOO.util.FunctionDataSource(matchUsers);
    ownerDS.responseSchema = {
        fields: ["id", "fname", "lname", "nname", "gravatar_lnk"]
    };

    // Instantiate AutoComplete for perms
    var membersAC = new YAHOO.widget.AutoComplete(divid, cont, memberDS);
    membersAC.useShadow = false;
    membersAC.resultTypeList = false;
    membersAC.animVert = false;
    membersAC.animHoriz = false;    
    membersAC.animSpeed = 0.1;

    // Instantiate AutoComplete for owner
    var ownerAC = new YAHOO.widget.AutoComplete("user", "owner_container", ownerDS);
    ownerAC.useShadow = false;
    ownerAC.resultTypeList = false;
    ownerAC.animVert = false;
    ownerAC.animHoriz = false;
    ownerAC.animSpeed = 0.1;

    // Helper highlight function for the formatter
    var highlightMatch = function (full, snippet, matchindex) {
            return full.substring(0, matchindex) 
            + "<span class='match'>" 
            + full.substr(matchindex, snippet.length) 
            + "</span>" + full.substring(matchindex + snippet.length);
        };

    // Custom formatter to highlight the matching letters
    var custom_formatter = function (oResultData, sQuery, sResultMatch) {
            var query = sQuery.toLowerCase();
            var _gravatar = function(res, em, group){
            	if (group !== undefined){
            		em = '/images/icons/group.png'
            	}
            	tmpl = '<div class="ac-container-wrap"><img class="perm-gravatar-ac" src="{0}"/>{1}</div>'
            	return tmpl.format(em,res)
            }
            // group
            if (oResultData.grname != undefined) {
                var grname = oResultData.grname;
                var grmembers = oResultData.grmembers;
                var grnameMatchIndex = grname.toLowerCase().indexOf(query);
                var grprefix = "{0}: ".format(_TM['Group']);
                var grsuffix = " (" + grmembers + "  )";
                var grsuffix = " ({0}  {1})".format(grmembers, _TM['members']);

                if (grnameMatchIndex > -1) {
                    return _gravatar(grprefix + highlightMatch(grname, query, grnameMatchIndex) + grsuffix,null,true);
                }
			    return _gravatar(grprefix + oResultData.grname + grsuffix, null,true);
            // Users
            } else if (oResultData.nname != undefined) {
                var fname = oResultData.fname || "";
                var lname = oResultData.lname || "";
                var nname = oResultData.nname;
                
                // Guard against null value
                var fnameMatchIndex = fname.toLowerCase().indexOf(query),
                    lnameMatchIndex = lname.toLowerCase().indexOf(query),
                    nnameMatchIndex = nname.toLowerCase().indexOf(query),
                    displayfname, displaylname, displaynname;

                if (fnameMatchIndex > -1) {
                    displayfname = highlightMatch(fname, query, fnameMatchIndex);
                } else {
                    displayfname = fname;
                }

                if (lnameMatchIndex > -1) {
                    displaylname = highlightMatch(lname, query, lnameMatchIndex);
                } else {
                    displaylname = lname;
                }

                if (nnameMatchIndex > -1) {
                    displaynname = "(" + highlightMatch(nname, query, nnameMatchIndex) + ")";
                } else {
                    displaynname = nname ? "(" + nname + ")" : "";
                }

                return _gravatar(displayfname + " " + displaylname + " " + displaynname, oResultData.gravatar_lnk);
            } else {
                return '';
            }
        };
    membersAC.formatResult = custom_formatter;
    ownerAC.formatResult = custom_formatter;

    var myHandler = function (sType, aArgs) {
    		var nextId = divid.split('perm_new_member_name_')[1];
            var myAC = aArgs[0]; // reference back to the AC instance
            var elLI = aArgs[1]; // reference to the selected LI element
            var oData = aArgs[2]; // object literal of selected item's result data
            //fill the autocomplete with value
            if (oData.nname != undefined) {
                //users
                myAC.getInputEl().value = oData.nname;
                YUD.get('perm_new_member_type_'+nextId).value = 'user';
            } else {
                //groups
                myAC.getInputEl().value = oData.grname;
                YUD.get('perm_new_member_type_'+nextId).value = 'users_group';
            }
        };

    membersAC.itemSelectEvent.subscribe(myHandler);
    if(ownerAC.itemSelectEvent){
    	ownerAC.itemSelectEvent.subscribe(myHandler);
    }

    return {
        memberDS: memberDS,
        ownerDS: ownerDS,
        membersAC: membersAC,
        ownerAC: ownerAC,
    };
}


var MentionsAutoComplete = function (divid, cont, users_list, groups_list) {
    var myUsers = users_list;
    var myGroups = groups_list;

    // Define a custom search function for the DataSource of users
    var matchUsers = function (sQuery) {
    	    var org_sQuery = sQuery;
    	    if(this.mentionQuery == null){
    	    	return []    	    	
    	    }
    	    sQuery = this.mentionQuery;
            // Case insensitive matching
            var query = sQuery.toLowerCase();
            var i = 0;
            var l = myUsers.length;
            var matches = [];

            // Match against each name of each contact
            for (; i < l; i++) {
                contact = myUsers[i];
                if (((contact.fname+"").toLowerCase().indexOf(query) > -1) || 
                	 ((contact.lname+"").toLowerCase().indexOf(query) > -1) || 
                	 ((contact.nname) && ((contact.nname).toLowerCase().indexOf(query) > -1))) {
                    matches[matches.length] = contact;
                }
            }
            return matches
        };

    //match all
    var matchAll = function (sQuery) {
            u = matchUsers(sQuery);
            return u
        };

    // DataScheme for owner
    var ownerDS = new YAHOO.util.FunctionDataSource(matchUsers);

    ownerDS.responseSchema = {
        fields: ["id", "fname", "lname", "nname", "gravatar_lnk"]
    };

    // Instantiate AutoComplete for mentions
    var ownerAC = new YAHOO.widget.AutoComplete(divid, cont, ownerDS);
    ownerAC.useShadow = false;
    ownerAC.resultTypeList = false;
    ownerAC.suppressInputUpdate = true;
    ownerAC.animVert = false;
    ownerAC.animHoriz = false;    
    ownerAC.animSpeed = 0.1;
    
    // Helper highlight function for the formatter
    var highlightMatch = function (full, snippet, matchindex) {
            return full.substring(0, matchindex) 
            + "<span class='match'>" 
            + full.substr(matchindex, snippet.length) 
            + "</span>" + full.substring(matchindex + snippet.length);
        };

    // Custom formatter to highlight the matching letters
    ownerAC.formatResult = function (oResultData, sQuery, sResultMatch) {
		    var org_sQuery = sQuery;
		    if(this.dataSource.mentionQuery != null){
		    	sQuery = this.dataSource.mentionQuery;		    	
		    }

            var query = sQuery.toLowerCase();
            var _gravatar = function(res, em, group){
            	if (group !== undefined){
            		em = '/images/icons/group.png'
            	}
            	tmpl = '<div class="ac-container-wrap"><img class="perm-gravatar-ac" src="{0}"/>{1}</div>'
            	return tmpl.format(em,res)
            }
            if (oResultData.nname != undefined) {
                var fname = oResultData.fname || "";
                var lname = oResultData.lname || "";
                var nname = oResultData.nname;
                
                // Guard against null value
                var fnameMatchIndex = fname.toLowerCase().indexOf(query),
                    lnameMatchIndex = lname.toLowerCase().indexOf(query),
                    nnameMatchIndex = nname.toLowerCase().indexOf(query),
                    displayfname, displaylname, displaynname;

                if (fnameMatchIndex > -1) {
                    displayfname = highlightMatch(fname, query, fnameMatchIndex);
                } else {
                    displayfname = fname;
                }

                if (lnameMatchIndex > -1) {
                    displaylname = highlightMatch(lname, query, lnameMatchIndex);
                } else {
                    displaylname = lname;
                }

                if (nnameMatchIndex > -1) {
                    displaynname = "(" + highlightMatch(nname, query, nnameMatchIndex) + ")";
                } else {
                    displaynname = nname ? "(" + nname + ")" : "";
                }

                return _gravatar(displayfname + " " + displaylname + " " + displaynname, oResultData.gravatar_lnk);
            } else {
                return '';
            }
        };

    if(ownerAC.itemSelectEvent){
    	ownerAC.itemSelectEvent.subscribe(function (sType, aArgs) {

            var myAC = aArgs[0]; // reference back to the AC instance
            var elLI = aArgs[1]; // reference to the selected LI element
            var oData = aArgs[2]; // object literal of selected item's result data
            //fill the autocomplete with value
            if (oData.nname != undefined) {
                //users
            	//Replace the mention name with replaced
            	var re = new RegExp();
            	var org = myAC.getInputEl().value;
            	var chunks = myAC.dataSource.chunks
            	// replace middle chunk(the search term) with actuall  match
            	chunks[1] = chunks[1].replace('@'+myAC.dataSource.mentionQuery,
            								  '@'+oData.nname+' ');
                myAC.getInputEl().value = chunks.join('')
                YUD.get(myAC.getInputEl()).focus(); // Y U NO WORK !?
            } else {
                //groups
                myAC.getInputEl().value = oData.grname;
                YUD.get('perm_new_member_type').value = 'users_group';
            }
        });
    }

    // in this keybuffer we will gather current value of search !
    // since we need to get this just when someone does `@` then we do the
    // search
    ownerAC.dataSource.chunks = [];
    ownerAC.dataSource.mentionQuery = null;

    ownerAC.get_mention = function(msg, max_pos) {
    	var org = msg;
    	var re = new RegExp('(?:^@|\s@)([a-zA-Z0-9]{1}[a-zA-Z0-9\-\_\.]+)$')
    	var chunks  = [];

		
    	// cut first chunk until curret pos
		var to_max = msg.substr(0, max_pos);		
		var at_pos = Math.max(0,to_max.lastIndexOf('@')-1);
		var msg2 = to_max.substr(at_pos);

		chunks.push(org.substr(0,at_pos))// prefix chunk
		chunks.push(msg2)                // search chunk
		chunks.push(org.substr(max_pos)) // postfix chunk

		// clean up msg2 for filtering and regex match
		var msg2 = msg2.lstrip(' ').lstrip('\n');

		if(re.test(msg2)){
			var unam = re.exec(msg2)[1];
			return [unam, chunks];
		}
		return [null, null];
    };
    
    if (ownerAC.textboxKeyUpEvent){
		ownerAC.textboxKeyUpEvent.subscribe(function(type, args){
			
			var ac_obj = args[0];
			var currentMessage = args[1];
			var currentCaretPosition = args[0]._elTextbox.selectionStart;
	
			var unam = ownerAC.get_mention(currentMessage, currentCaretPosition); 
			var curr_search = null;
			if(unam[0]){
				curr_search = unam[0];
			}
			
			ownerAC.dataSource.chunks = unam[1];
			ownerAC.dataSource.mentionQuery = curr_search;
	
		})
	}	
    return {
        ownerDS: ownerDS,
        ownerAC: ownerAC,
    };
}


var PullRequestAutoComplete = function (divid, cont, users_list, groups_list) {
    var myUsers = users_list;
    var myGroups = groups_list;

    // Define a custom search function for the DataSource of users
    var matchUsers = function (sQuery) {
            // Case insensitive matching
            var query = sQuery.toLowerCase();
            var i = 0;
            var l = myUsers.length;
            var matches = [];

            // Match against each name of each contact
            for (; i < l; i++) {
                contact = myUsers[i];
                if (((contact.fname+"").toLowerCase().indexOf(query) > -1) || 
                   	 ((contact.lname+"").toLowerCase().indexOf(query) > -1) || 
                   	 ((contact.nname) && ((contact.nname).toLowerCase().indexOf(query) > -1))) {
                       matches[matches.length] = contact;
                   }
            }
            return matches;
        };

    // Define a custom search function for the DataSource of usersGroups
    var matchGroups = function (sQuery) {
            // Case insensitive matching
            var query = sQuery.toLowerCase();
            var i = 0;
            var l = myGroups.length;
            var matches = [];

            // Match against each name of each contact
            for (; i < l; i++) {
                matched_group = myGroups[i];
                if (matched_group.grname.toLowerCase().indexOf(query) > -1) {
                    matches[matches.length] = matched_group;
                }
            }
            return matches;
        };

    //match all
    var matchAll = function (sQuery) {
            u = matchUsers(sQuery);
            return u
        };

    // DataScheme for owner
    var ownerDS = new YAHOO.util.FunctionDataSource(matchUsers);

    ownerDS.responseSchema = {
        fields: ["id", "fname", "lname", "nname", "gravatar_lnk"]
    };

    // Instantiate AutoComplete for mentions
    var reviewerAC = new YAHOO.widget.AutoComplete(divid, cont, ownerDS);
    reviewerAC.useShadow = false;
    reviewerAC.resultTypeList = false;
    reviewerAC.suppressInputUpdate = true;
    reviewerAC.animVert = false;
    reviewerAC.animHoriz = false;    
    reviewerAC.animSpeed = 0.1;
    
    // Helper highlight function for the formatter
    var highlightMatch = function (full, snippet, matchindex) {
            return full.substring(0, matchindex) 
            + "<span class='match'>" 
            + full.substr(matchindex, snippet.length) 
            + "</span>" + full.substring(matchindex + snippet.length);
        };

    // Custom formatter to highlight the matching letters
    reviewerAC.formatResult = function (oResultData, sQuery, sResultMatch) {
		    var org_sQuery = sQuery;
		    if(this.dataSource.mentionQuery != null){
		    	sQuery = this.dataSource.mentionQuery;		    	
		    }

            var query = sQuery.toLowerCase();
            var _gravatar = function(res, em, group){
            	if (group !== undefined){
            		em = '/images/icons/group.png'
            	}
            	tmpl = '<div class="ac-container-wrap"><img class="perm-gravatar-ac" src="{0}"/>{1}</div>'
            	return tmpl.format(em,res)
            }
            if (oResultData.nname != undefined) {
                var fname = oResultData.fname || "";
                var lname = oResultData.lname || "";
                var nname = oResultData.nname;
                
                // Guard against null value
                var fnameMatchIndex = fname.toLowerCase().indexOf(query),
                    lnameMatchIndex = lname.toLowerCase().indexOf(query),
                    nnameMatchIndex = nname.toLowerCase().indexOf(query),
                    displayfname, displaylname, displaynname;

                if (fnameMatchIndex > -1) {
                    displayfname = highlightMatch(fname, query, fnameMatchIndex);
                } else {
                    displayfname = fname;
                }

                if (lnameMatchIndex > -1) {
                    displaylname = highlightMatch(lname, query, lnameMatchIndex);
                } else {
                    displaylname = lname;
                }

                if (nnameMatchIndex > -1) {
                    displaynname = "(" + highlightMatch(nname, query, nnameMatchIndex) + ")";
                } else {
                    displaynname = nname ? "(" + nname + ")" : "";
                }

                return _gravatar(displayfname + " " + displaylname + " " + displaynname, oResultData.gravatar_lnk);
            } else {
                return '';
            }
        };
        
    //members cache to catch duplicates
    reviewerAC.dataSource.cache = [];
    // hack into select event
    if(reviewerAC.itemSelectEvent){
    	reviewerAC.itemSelectEvent.subscribe(function (sType, aArgs) {

            var myAC = aArgs[0]; // reference back to the AC instance
            var elLI = aArgs[1]; // reference to the selected LI element
            var oData = aArgs[2]; // object literal of selected item's result data
            var members  = YUD.get('review_members');
            //fill the autocomplete with value

            if (oData.nname != undefined) {
            	if (myAC.dataSource.cache.indexOf(oData.id) != -1){
            		return
            	}

            	var tmpl = '<li id="reviewer_{2}">'+
		                      '<div class="reviewers_member">'+
		                        '<div class="gravatar"><img alt="gravatar" src="{0}"/> </div>'+
		                        '<div style="float:left">{1}</div>'+
		                        '<input type="hidden" value="{2}" name="review_members" />'+
		                        '<span class="delete_icon action_button" onclick="removeReviewer({2})"></span>'+
		                      '</div>'+
		                   '</li>'

		        var displayname = "{0} {1} ({2})".format(oData.fname,oData.lname,oData.nname);
            	var element = tmpl.format(oData.gravatar_lnk,displayname,oData.id);
            	members.innerHTML += element;
            	myAC.dataSource.cache.push(oData.id);
            	YUD.get('user').value = '' 
            }
    	});        
    }
    return {
        ownerDS: ownerDS,
        reviewerAC: reviewerAC,
    };
}


/**
 * QUICK REPO MENU
 */
var quick_repo_menu = function(){
    YUE.on(YUQ('.quick_repo_menu'),'mouseenter',function(e){
            var menu = e.currentTarget.firstElementChild.firstElementChild;
            if(YUD.hasClass(menu,'hidden')){
                YUD.replaceClass(e.currentTarget,'hidden', 'active');
                YUD.replaceClass(menu, 'hidden', 'active');
            }
        })
    YUE.on(YUQ('.quick_repo_menu'),'mouseleave',function(e){
            var menu = e.currentTarget.firstElementChild.firstElementChild;
            if(YUD.hasClass(menu,'active')){
                YUD.replaceClass(e.currentTarget, 'active', 'hidden');
                YUD.replaceClass(menu, 'active', 'hidden');
            }
        })
};


/**
 * TABLE SORTING
 */

// returns a node from given html;
var fromHTML = function(html){
	  var _html = document.createElement('element');
	  _html.innerHTML = html;
	  return _html;
}
var get_rev = function(node){
    var n = node.firstElementChild.firstElementChild;
    
    if (n===null){
        return -1
    }
    else{
        out = n.firstElementChild.innerHTML.split(':')[0].replace('r','');
        return parseInt(out);
    }
}

var get_name = function(node){
	 var name = node.firstElementChild.children[2].innerHTML; 
	 return name
}
var get_group_name = function(node){
	var name = node.firstElementChild.children[1].innerHTML;
	return name
}
var get_date = function(node){
	var date_ = YUD.getAttribute(node.firstElementChild,'date');
	return date_
}

var get_age = function(node){
	return node
}

var get_link = function(node){
	return node.firstElementChild.text;
}

var revisionSort = function(a, b, desc, field) {
	  
	  var a_ = fromHTML(a.getData(field));
	  var b_ = fromHTML(b.getData(field));
	  
	  // extract revisions from string nodes 
	  a_ = get_rev(a_)
	  b_ = get_rev(b_)
	      	  
	  var comp = YAHOO.util.Sort.compare;
	  var compState = comp(a_, b_, desc);
	  return compState;
};
var ageSort = function(a, b, desc, field) {
    var a_ = fromHTML(a.getData(field));
    var b_ = fromHTML(b.getData(field));
    
    // extract name from table
    a_ = get_date(a_)
    b_ = get_date(b_)          
    
    var comp = YAHOO.util.Sort.compare;
    var compState = comp(a_, b_, desc);
    return compState;
};

var lastLoginSort = function(a, b, desc, field) {
	var a_ = a.getData('last_login_raw') || 0;
    var b_ = b.getData('last_login_raw') || 0;
    
    var comp = YAHOO.util.Sort.compare;
    var compState = comp(a_, b_, desc);
    return compState;
};

var nameSort = function(a, b, desc, field) {
    var a_ = fromHTML(a.getData(field));
    var b_ = fromHTML(b.getData(field));

    // extract name from table
    a_ = get_name(a_)
    b_ = get_name(b_)          
    
    var comp = YAHOO.util.Sort.compare;
    var compState = comp(a_, b_, desc);
    return compState;
};

var permNameSort = function(a, b, desc, field) {
    var a_ = fromHTML(a.getData(field));
    var b_ = fromHTML(b.getData(field));
    // extract name from table

    a_ = a_.children[0].innerHTML;
    b_ = b_.children[0].innerHTML;      
    
    var comp = YAHOO.util.Sort.compare;
    var compState = comp(a_, b_, desc);
    return compState;
};

var groupNameSort = function(a, b, desc, field) {
    var a_ = fromHTML(a.getData(field));
    var b_ = fromHTML(b.getData(field));
    
    // extract name from table
    a_ = get_group_name(a_)
    b_ = get_group_name(b_)          
    
    var comp = YAHOO.util.Sort.compare;
    var compState = comp(a_, b_, desc);
    return compState;
};
var dateSort = function(a, b, desc, field) {
    var a_ = fromHTML(a.getData(field));
    var b_ = fromHTML(b.getData(field));
    
    // extract name from table
    a_ = get_date(a_)
    b_ = get_date(b_)          
    
    var comp = YAHOO.util.Sort.compare;
    var compState = comp(a_, b_, desc);
    return compState;
};

var linkSort = function(a, b, desc, field) {
	  var a_ = fromHTML(a.getData(field));
	  var b_ = fromHTML(a.getData(field));
	  
	  // extract url text from string nodes 
	  a_ = get_link(a_)
	  b_ = get_link(b_)

	  var comp = YAHOO.util.Sort.compare;
	  var compState = comp(a_, b_, desc);
	  return compState;
}

var addPermAction = function(_html, users_list, groups_list){
    var elmts = YUD.getElementsByClassName('last_new_member');
    var last_node = elmts[elmts.length-1];
    if (last_node){
       var next_id = (YUD.getElementsByClassName('new_members')).length;
       _html = _html.format(next_id);
       last_node.innerHTML = _html;
       YUD.setStyle(last_node, 'display', '');
       YUD.removeClass(last_node, 'last_new_member');
       MembersAutoComplete("perm_new_member_name_"+next_id, 
               "perm_container_"+next_id, users_list, groups_list);          
       //create new last NODE
       var el = document.createElement('tr');
       el.id = 'add_perm_input';
       YUD.addClass(el,'last_new_member');
       YUD.addClass(el,'new_members');
       YUD.insertAfter(el, last_node);
    }	
}

/* Multi selectors */

var MultiSelectWidget = function(selected_id, available_id, form_id){


	//definition of containers ID's
	var selected_container = selected_id;
	var available_container = available_id;
	
	//temp container for selected storage.
	var cache = new Array();
	var av_cache = new Array();
	var c =  YUD.get(selected_container);
	var ac = YUD.get(available_container);
	
	//get only selected options for further fullfilment
	for(var i = 0;node =c.options[i];i++){
	    if(node.selected){
	        //push selected to my temp storage left overs :)
	        cache.push(node);
	    }
	}
	
	//get all available options to cache
	for(var i = 0;node =ac.options[i];i++){
	        //push selected to my temp storage left overs :)
	        av_cache.push(node);
	}
	
	//fill available only with those not in choosen
	ac.options.length=0;
	tmp_cache = new Array();
	
	for(var i = 0;node = av_cache[i];i++){
	    var add = true;
	    for(var i2 = 0;node_2 = cache[i2];i2++){
	        if(node.value == node_2.value){
	            add=false;
	            break;
	        }
	    }
	    if(add){
	        tmp_cache.push(new Option(node.text, node.value, false, false));
	    }
	}
	
	for(var i = 0;node = tmp_cache[i];i++){
	    ac.options[i] = node;
	}
	
	function prompts_action_callback(e){
	
	    var choosen = YUD.get(selected_container);
	    var available = YUD.get(available_container);
	
	    //get checked and unchecked options from field
	    function get_checked(from_field){
	        //temp container for storage.
	        var sel_cache = new Array();
	        var oth_cache = new Array();
	
	        for(var i = 0;node = from_field.options[i];i++){
	            if(node.selected){
	                //push selected fields :)
	                sel_cache.push(node);
	            }
	            else{
	                oth_cache.push(node)
	            }
	        }
	
	        return [sel_cache,oth_cache]
	    }
	
	    //fill the field with given options
	    function fill_with(field,options){
	        //clear firtst
	        field.options.length=0;
	        for(var i = 0;node = options[i];i++){
	                field.options[i]=new Option(node.text, node.value,
	                        false, false);
	        }
	
	    }
	    //adds to current field
	    function add_to(field,options){
	        for(var i = 0;node = options[i];i++){
	                field.appendChild(new Option(node.text, node.value,
	                        false, false));
	        }
	    }
	
	    // add action
	    if (this.id=='add_element'){
	        var c = get_checked(available);
	        add_to(choosen,c[0]);
	        fill_with(available,c[1]);
	    }
	    // remove action
	    if (this.id=='remove_element'){
	        var c = get_checked(choosen);
	        add_to(available,c[0]);
	        fill_with(choosen,c[1]);
	    }
	    // add all elements
	    if(this.id=='add_all_elements'){
	        for(var i=0; node = available.options[i];i++){
	                choosen.appendChild(new Option(node.text,
	                        node.value, false, false));
	        }
	        available.options.length = 0;
	    }
	    //remove all elements
	    if(this.id=='remove_all_elements'){
	        for(var i=0; node = choosen.options[i];i++){
	            available.appendChild(new Option(node.text,
	                    node.value, false, false));
	        }
	        choosen.options.length = 0;
	    }
	
	}
	
	YUE.addListener(['add_element','remove_element',
	               'add_all_elements','remove_all_elements'],'click',
	               prompts_action_callback)
	if (form_id !== undefined) {
		YUE.addListener(form_id,'submit',function(){
		    var choosen = YUD.get(selected_container);
		    for (var i = 0; i < choosen.options.length; i++) {
		        choosen.options[i].selected = 'selected';
		    }
		});
	}
}

(function() {
	var cache = {};
	var scopes = {};
	var express = /\{\s*\{([^\{\}]*)\}\s*\}/g;
	var variable = /\w+/g;
	var $each = /(@each)\s*\((.*)\s*,\s*\{/g;
	var $when = /(@when)\s*\((.*)\s*,\s*\{/g;
	var $chen = /(@each|@when)\s*\((.*)\s*,\s*\{/g;
	var $close = /\s*\}\s*\)/g;
	function define(scope) {
		scopes = new scope();
		init(query("body"));
		initCompiler(query("body"), cache, scopes);
		observe(scopes, function(name, path) {
			each(cache[path], this, function(node) {
				resolver[node.resolver](node, scopes);
			});
		});
	}
	var resolver = {
		express : function(node, scope) {
			node.rnode.nodeValue = code(node.cnode.nodeValue, scope);
			if (node.rnode.name == "value")
				node.rnode.ownerElement.value = node.rnode.nodeValue;
		},
		attribute : function(node, scope) {
			try {
				var newNode = document.createAttribute(code(node.cnode.name, scope));
				node.rnode.ownerElement.setAttributeNode(newNode);
				node.rnode.ownerElement.removeAttributeNode(node.rnode);
				node.rnode = newNode;
			} catch (e) {
				console.log(e);
			}
		},
		chen : function(node, scope) {
			clearCache(node.cnode);
			clearScache(cache);
			eachCompiler([ node.cnode ], scope, node.rnode);
		}
	};
	function code(_express, _scope) {
		with (_scope) {
			return eval("\"" + _express.replace(/\{\s*\{([^\{\}]*)\}\s*\}/g, "\"\+\($1)\+\"").replace(/[\f\n\r\v]/g, "") + "\"");
		}
	}
	function codei(_express, _scope) {
		with (_scope) {
			return eval(_express);
		}
	}
	function nodeList(nodes) {
		return each(nodes, [], function(node, i, list) {
			list.push(this);
		});
	}
	function setCache(node, iscope, rnode) {
		if (node.name == "value")
			binding(node.ownerElement, node, iscope);
		if (node.nodeValue == null)
			return;
		(node.name || "").replace(express, function(key) {
			key = key.replace(express, "$1");
			if(!codei(key,iscope))
				return;
			cache[key] = cache[key] || [];
			cache[key].push({
				resolver : "attribute",
				cnode : node,
				rnode : rnode,
				scache : true
			});
		});
		node.nodeValue.replace(express, function(key) {
			key = key.replace(express, "$1");
			if(!codei(key,iscope))
				return;
			cache[key] = cache[key] || [];
			cache[key].push({
				resolver : "express",
				cnode : node.cloneNode(true),
				rnode : node,
				scache : true
			});
		});
	}
	function clearCache(node) {
		node.cache = node.cache || [];
		each(node.cache, node.cache, function(node, i, cache) {
			if (node.cache)
				clearCache(node);
			if (node.parentNode)
				node.parentNode.removeChild(node);
			delete cache[i];
		});
	}
	function clearScache(cache) {
		each(cache, function() {
			for ( var key in this) {
				if (this[key].scache)
					this.splice(key, 1);
			}
		});
	}
	var index = 0;
	function eachNode(node) {
		var next = node.childList ? node.nextSibling : node.firstChild,prev;
		while (next) {
			if (node.childList) {
				if ($close.test(next.nodeValue)) {
					next.parentNode.removeChild(next);
					break;
				}
				node.childList.push(next);
			}
			if ($chen.test(next.nodeValue)) {
				next.childList = [];
				index++;
				eachNode(next);
				index--;
			}
			prev = next;
			next = next.nextSibling;
			if (node.childList&&index != 0) {
				prev.parentNode.removeChild(prev);
			}
		}
	}
	function init(dom) {
		each(dom, function(node) {
			if (node.childNodes[0]&&node.nodeName != "SCRIPT") 
			    init(nodeList(node.childNodes));
			switch (node.nodeType) {
			case 3:
				node.nodeValue.replace(/((@each|@when)\s*\((.*)\s*,\s*\{|\{\s*\{\w*\}\s*\}|\s*\}\s*\))/g, function(tag) {
					var nodes = node.nodeValue.split(tag);
					(node.parentNode).insertBefore(document.createTextNode(nodes[0]), node);
					(node.parentNode).insertBefore(document.createTextNode(tag), node);
					node.nodeValue = node.nodeValue.replace(nodes[0], "").replace(tag, "");
				});
			}
		});
	}
	function initCompiler(dom, cache, scope) {
		each(dom, function(node) {
			switch (node.nodeType) {
			case 1:
				if (node.hasAttribute("each")) {
					var key = node.getAttribute("each").split(":").pop();
					cache[key] = cache[key] || [];
					var TextNode = document.createTextNode("");
					node.parentNode.replaceChild(TextNode, node);
					cache[key].push({
						resolver : "chen",
						cnode : node.clone(true),
						rnode : TextNode,
						cache : []
					});
					return;
				}
			default:
				if (node.childNodes[0])
					initCompiler(node.childNodes, cache, scope);
				each(node.attributes, function(node) {
					node.name.replace(express, function(tag) {
						var key = tag.replace(express, "$1");
						cache[key] = cache[key] || [];
						cache[key].push({
							resolver : "attribute",
							cnode : node.cloneNode(true),
							rnode : node
						});
					});
					node.nodeValue.replace(express, function(tag) {
						if (node.name == "value")
							binding(node.ownerElement, node, scope)
						var key = tag.replace(express, "$1");
						cache[key] = cache[key] || [];
						cache[key].push({
							resolver : "express",
							cnode : node.cloneNode(true),
							rnode : node
						});
					});
				});
				(node.nodeValue || "").replace($each, function(tag) {
					if (!node.childList)
						eachNode(node.parentNode);
					var key = node.nodeValue.replace($each, "$2").split(":").pop();
					cache[key] = cache[key] || [];
					var TextNode = document.createTextNode("");
					node.parentNode.replaceChild(TextNode, node);
					cache[key].push({
						resolver : "chen",
						cnode : node,
						rnode : TextNode,
						cache : []
					});
				});
				(node.nodeValue || "").replace($when, function(tag) {
					if (!node.childList)
						eachNode(node.parentNode);
					var TextNode = document.createTextNode("");
					node.parentNode.replaceChild(TextNode, node);
					node.nodeValue.replace(variable,function(key){
						if(!scope[key])
						  return;
						cache[key] = cache[key] || [];
						cache[key].push({
							resolver : "chen",
							cnode : node,
							rnode : TextNode,
							cache : []
						});
					})
				});
				(node.nodeValue || "").replace(express, function(tag) {
					var key = tag.replace(express, "$1");
					cache[key] = cache[key] || [];
					cache[key].push({
						resolver : "express",
						cnode : node.cloneNode(true),
						rnode : node
					});
				});
				break;
			}
		});
		return cache;
	}
	function eachCompiler(node, iscope, content) {
		each(node, function(node) {
			if (!content && !node.parentNode)
				return;
			var insertion = (content || node);
			switch (node.nodeType) {
			case 1:
				if (node.hasAttribute("each")) {
					var expreses = node.getAttribute("each").split(":");
					node.variable = expreses.shift(), node.dataSource = expreses.pop();
					node.cache = node.cache || [];
					var scope = Object.create(iscope || {});
					each(codei(node.dataSource, iscope), function(item, index) {
						scope[node.variable] = item, scope["index"] = index;
						var newNode = node.clone(true);
						newNode.removeAttribute("each");
						node.cache.push(newNode);
						insertion.parentNode.insertBefore(newNode, insertion);
						each(nodeList(newNode.attributes), function(node) {
							node.name.replace(express, function(tag) {
								var newNode = document.createAttribute(code(node.name, scope));
								node.ownerElement.setAttributeNode(newNode);
								node.ownerElement.removeAttributeNode(node);
								setCache(node, scope, newNode);
							});
							node.nodeValue.replace(express, function() {
								setCache(node, scope, newNode);
								node.nodeValue = code(node.nodeValue, scope);
							});
						});
						if (!newNode.childList)
							eachNode(newNode);
						each(nodeList(newNode.childNodes), function(child) {
							switch (child.nodeType) {
							case 1:
								eachCompiler([ child ], scope);
								break;
							default:
								child.nodeValue.replace($chen, function() {
									eachCompiler([ child ], scope);
								});
								child.nodeValue.replace(express, function() {
									setCache(child, scope);
									child.nodeValue = code(child.nodeValue, scope);
								});
							}
						});
					});
					if (node.parentNode)
						node.parentNode.removeChild(node);
					break;
				}
			default:
				switch (typeof(node.nodeValue)) {
				case "string":
					if (node.nodeValue.match($each)) {
						var expreses = node.nodeValue.replace($each, "$2").split(":");
						node.variable = expreses.shift(), node.dataSource = expreses.pop();
						node.cache = node.cache || [];
						var childList = nodeList(node.childList);
						var scope = Object.create(iscope || {});
						each(codei(node.dataSource, iscope), function(item, index) {
							scope[node.variable] = item, scope["index"] = index;
							each(childList, function(child) {
								var newNode = this.clone(true);
								node.cache.push(newNode);
								insertion.parentNode.insertBefore(newNode, insertion);
								switch (child.nodeType) {
								case 1:
									eachCompiler([ newNode ], scope);
									break;
								default:
									newNode.nodeValue.replace($chen, function() {
										if (child.childList)
											newNode.childList = child.childList;
										eachCompiler([ newNode ], scope);
									});
									newNode.nodeValue.replace(express, function() {
										setCache(newNode, scope);
										newNode.nodeValue = code(newNode.nodeValue, scope);
									});
								}
							});
						});
						if (!content)
							node.parentNode.removeChild(node);
						break;
					}
					if (node.nodeValue.match($when)) {
						var expreses = node.nodeValue.replace($when, "$2");
						if (codei(expreses,iscope)) {
							node.cache = node.cache || [];
							each(nodeList(node.childList), function(child) {
								var newNode = this.clone(true);
								node.cache.push(newNode);
								insertion.parentNode.insertBefore(newNode, insertion);
								switch (child.nodeType) {
								case 1:
									eachCompiler([ newNode ], iscope);
									break;
								default:
									newNode.nodeValue.replace($chen, function() {
										if (child.childList)
											newNode.childList = child.childList;
										eachCompiler([ newNode ], iscope);
									});
									newNode.nodeValue.replace(express, function() {
										setCache(newNode, iscope);
										newNode.nodeValue = code(newNode.nodeValue, iscope);
									});
								}
							});
						}
						if (!content)
							node.parentNode.removeChild(node);
						break;
					}
				default:
					each(nodeList(node.attributes), function(node) {
						node.name.replace(express, function(tag) {
							var newNode = document.createAttribute(code(node.name, iscope));
							node.ownerElement.setAttributeNode(newNode);
							node.ownerElement.removeAttributeNode(node);
							setCache(node, iscope, newNode);
						});
						node.nodeValue.replace(express, function() {
							setCache(node, iscope);
							node.nodeValue = code(node.nodeValue, iscope);
						});
					});
				    if (!node.childList)
					    eachNode(node);
					each(nodeList(node.childNodes), function(child) {
						switch (child.nodeType) {
						case 1:
							eachCompiler([ child ], iscope);
							break;
						default:
							child.nodeValue.replace($chen, function() {
								eachCompiler([ child ], iscope);
							});
							child.nodeValue.replace(express, function() {
								setCache(child, iscope);
								child.nodeValue = code(child.nodeValue, iscope);
							});
						}
					});
				}
			}
		});
	}
	window.define = define;
	window.codei = codei;
})(window);
(function() {
	function binding(elem, node, scope) {
		var express = /\{\s*\{([^\{\}]*)\}\s*\}/g;
		elem.model = node.nodeValue.replace(express, "$1");
		elem.on("change", function handle() {
			codei(elem.model +"='"+elem.value.replace(/(\'|\")/g,"\\$1")+"'",scope);
		});
	}
	function ready(func) {
		var done = false, init = function() {
			if (done) {
				document.removeEventListener("DOMContentLoaded", init, false);
				window.removeEventListener("load", init, false);
				func();
				return;
			}
			if (document.readyState == "complete") {
				done = true;
				init();
			}
		};
		document.addEventListener("DOMContentLoaded", init, false);
		window.addEventListener("load", init, false);
		init();
	}
	function setPrototype(object, config) {
		for ( var key in config) {
			object.prototype[key] = config[key];
		}
	}
	setPrototype(Node, {
		on : function(type, call) {
			this["eventManager"] = this["eventManager"] || {};
			if (!this["eventManager"][type]) {
				this["eventManager"][type] = [];
				this.addEventListener(type, function(e) {
					each(this["eventManager"][type], function() {
						this();
					});
				}, false);
			}
			this["eventManager"][type].push(call);
		},
		off : function(type, call) {
			each(this["eventManager"][type], this["eventManager"][type], function(fuc, i, list) {
				if (call != undefined && this != call)
					return;
				delete list[i];
			});
			if (!this["eventManager"][type][0])
				this.removeEventListener(type, call, false);
		},
		clone : function() {
			switch (this.nodeType) {
			case 1:
				if (undefined != window.jQuery)
					return jQuery(this).clone(true)[0];
			default:
				var node = this.cloneNode(true);
				each(node["eventManager"] = this["eventManager"], function(list, type) {
					node.addEventListener(type, function(e) {
						each(this["eventManager"][type], function() {
							this();
						});
					}, false);
				});
				return node;
			}
		}
	});
	setPrototype(NodeList, {
		on : function(type, call, bol) {
			each(this, function(node) {
				node.on(type, call, bol);
			});
		},
		off : function(type, call, bol) {
			each(this, function(node) {
				node.off(type, call, bol);
			});
		},
		append : function(node) {
			switch (typeof node) {
			case "string":
				var newNode = document.createElement("div");
				newNode.innerHTML = node;
				each(newNode.childNodes, this[0], function(node, i, thiz) {
					thiz.appendChild(node);
				});
				break;
			default:
				switch (node.length) {
				case undefined:
					this[0].appendChild(node);
					break;
				default:
					each(node, this[0], function(node, i, thiz) {
						thiz.appendChild(node);
					});
					break;
				}
				break;
			}
		},
		after : function(node) {
			switch (typeof node) {
			case "string":
				var newNode = document.createElement("div");
				newNode.innerHTML = node;
				each(newNode.childNodes, this[0], function(node, i, thiz) {
					thiz.parentNode.insertBefore(this, thiz.nextSibling);
				});
				break;
			default:
				switch (node.length) {
				case undefined:
					this[0].parentNode.insertBefore(node, this[0].nextSibling);
					break;
				default:
					each(node, this[0], function(node, i, thiz) {
						thiz.parentNode.insertBefore(node, thiz.nextSibling);
					});
					break;
				}
				break;
			}
		},
		before : function(node) {
			switch (typeof node) {
			case "string":
				var newNode = document.createElement("div");
				newNode.innerHTML = node;
				each(newNode.childNodes, this[0], function(node, i, thiz) {
					thiz.parentNode.insertBefore(this, thiz);
				});
				break;
			default:
				switch (node.length) {
				case undefined:
					this[0].parentNode.insertBefore(node, this[0]);
					break;
				default:
					each(node, this[0], function(node, i, thiz) {
						thiz.parentNode.insertBefore(node, thiz);
					});
					break;
				}
				break;
			}
		},
		replace : function(node) {
			switch (typeof node) {
			case "string":
				var newNode = document.createElement("div");
				newNode.innerHTML = node;
				each(newNode.childNodes, this[0], function(node, i, thiz) {
					thiz.parentNode.replaceChild(this, thiz);
				});
				break;
			default:
				switch (node.length) {
				case undefined:
					this[0].parentNode.replaceChild(node, this[0]);
					break;
				default:
					each(node, this[0], function(node, i, thiz) {
						thiz.parentNode.replaceChild(node, thiz);
					});
					break;
				}
				break;
			}
		},
		remove : function() {
			each(this, function(node) {
				node.parentNode.removeChild(node);
			});
		},
		clone : function(bol) {
			return this[0].cloneNode(bol || true);
		}
	});
	function query(express) {
		try {
			var doc = document.querySelectorAll(express);
			switch (typeof doc[0]) {
			case undefined:
				var newNode = document.createElement("div");
				newNode.innerHTML = express;
				return newNode.childNodes;
			default:
				return doc;
			}
		} catch (e) {
			var newNode = document.createElement("div");
			newNode.innerHTML = express;
			return newNode.childNodes;
		}
	}
	function each(obj, arg, fu) {
		var args = arguments, func = (args[2] || args[1]), argu = (2 < args.length ? arg : undefined);
		if (1 > args.length || obj == null || typeof obj != "object" || typeof func != "function") {
			return;
		}
		if (obj.length != undefined) {
			for ( var i = 0; i < obj.length; i++) {
				if (obj.hasOwnProperty(i)) {
					func.call(obj[i], obj[i], i, argu);
				}
			}
		} else {
			for ( var i in obj) {
				if (obj.hasOwnProperty(i)) {
					func.call(obj[i], obj[i], i, argu);
				}
			}
		}
		if (2 < args.length) {
			return argu;
		}
	}
	function log(obj) {
		console.log(obj);
	}
	window.binding = binding;
	window.query = query;
	window.ready = ready;
	window.each = each;
	window.log = log;
})(window);
(function() {
	var observe = function(target, callback) {
		var object = {};
		var _observe = function(target, callback, object, rootPath) {
			if (typeof target == "object") {
				for ( var prop in target) {
					var path = Object.create(rootPath || []);
					if (target.hasOwnProperty(prop)) {
						if (!Object.getOwnPropertyDescriptor(target, prop).set) {
							path.push(prop);
							if (typeof target[prop] == "object") {
								_observe(target[prop], callback, object[prop] = {}, path);
							}
							_watch(target, prop, object, path);
						}
					}
				}
			}
			return target;
		};
		var _watch = function(target, prop, object, path) {
			var value = target[prop];
			path = path.join(".");
			Object.defineProperty(target, prop, {
				get : function() {
					return object[prop];
				},
				set : function(value) {
					object[prop] = _observe(value, callback, object);
					callback.call(this, prop, path);
				}
			});
			target[prop] = value;
		};
		return new _observe(target, callback, object);
	};
	window.observe = observe;
})(window);

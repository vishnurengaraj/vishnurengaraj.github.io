(function(e){function t(t){for(var n,s,i=t[0],l=t[1],u=t[2],v=0,d=[];v<i.length;v++)s=i[v],Object.prototype.hasOwnProperty.call(o,s)&&o[s]&&d.push(o[s][0]),o[s]=0;for(n in l)Object.prototype.hasOwnProperty.call(l,n)&&(e[n]=l[n]);c&&c(t);while(d.length)d.shift()();return a.push.apply(a,u||[]),r()}function r(){for(var e,t=0;t<a.length;t++){for(var r=a[t],n=!0,i=1;i<r.length;i++){var l=r[i];0!==o[l]&&(n=!1)}n&&(a.splice(t--,1),e=s(s.s=r[0]))}return e}var n={},o={app:0},a=[];function s(t){if(n[t])return n[t].exports;var r=n[t]={i:t,l:!1,exports:{}};return e[t].call(r.exports,r,r.exports,s),r.l=!0,r.exports}s.m=e,s.c=n,s.d=function(e,t,r){s.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:r})},s.r=function(e){"undefined"!==typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},s.t=function(e,t){if(1&t&&(e=s(e)),8&t)return e;if(4&t&&"object"===typeof e&&e&&e.__esModule)return e;var r=Object.create(null);if(s.r(r),Object.defineProperty(r,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var n in e)s.d(r,n,function(t){return e[t]}.bind(null,n));return r},s.n=function(e){var t=e&&e.__esModule?function(){return e["default"]}:function(){return e};return s.d(t,"a",t),t},s.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},s.p="/";var i=window["webpackJsonp"]=window["webpackJsonp"]||[],l=i.push.bind(i);i.push=t,i=i.slice();for(var u=0;u<i.length;u++)t(i[u]);var c=l;a.push([0,"chunk-vendors"]),r()})({0:function(e,t,r){e.exports=r("56d7")},4805:function(e,t,r){"use strict";var n=r("8ce0"),o=r.n(n);o.a},"56d7":function(e,t,r){"use strict";r.r(t);r("e260"),r("e6cf"),r("cca6"),r("a79d"),r("0cdd");var n=r("2b0e"),o=r("5f5b");r("ab8b"),r("2dd8");n["default"].use(o["a"]);var a=r("43f9"),s=r.n(a),i=(r("51de"),r("e094"),r("98c9")),l=r("ca95"),u=r.n(l),c=r("f0eb"),v=function(){var e=this,t=e.$createElement,r=e._self._c||t;return r("div",{attrs:{id:"app"}},[r("div",{attrs:{id:"nav"}},[r("router-link",{attrs:{to:"/",name:"Home"}},[e._v("Home")]),e._v(" | "),r("router-link",{attrs:{to:"/about"}},[e._v("About")]),e._v(" | "),r("router-link",{attrs:{to:"/title"}},[e._v("Title")]),e._v(" | "),r("router-link",{attrs:{to:{name:"Home2Resume"}}},[e._v("Resume")])],1),r("vue-page-transition",{attrs:{name:"fade"}},[r("router-view")],1)],1)},d=[],p=(r("5c0b"),r("2877")),f={},m=Object(p["a"])(f,v,d,!1,null,null,null),h=m.exports,_=r("8c4f"),b=function(){var e=this,t=e.$createElement,n=e._self._c||t;return n("div",{staticClass:"home"},[n("img",{attrs:{alt:"Vue logo",src:r("cf05")}}),n("HelloWorld",{attrs:{msg:"Welcome to Your Vue.js App"}})],1)},g=[],w=function(){var e=this,t=e.$createElement,r=e._self._c||t;return r("div",{staticClass:"hello"},[r("h1",[e._v(e._s(e.msg))]),e._m(0),r("h3",[e._v("Installed CLI Plugins")]),e._m(1),r("h3",[e._v("Essential Links")]),e._m(2),r("h3",[e._v("Ecosystem")]),e._m(3)])},k=[function(){var e=this,t=e.$createElement,r=e._self._c||t;return r("p",[e._v(" For a guide and recipes on how to configure / customize this project,"),r("br"),e._v(" check out the "),r("a",{attrs:{href:"https://cli.vuejs.org",target:"_blank",rel:"noopener"}},[e._v("vue-cli documentation")]),e._v(". ")])},function(){var e=this,t=e.$createElement,r=e._self._c||t;return r("ul",[r("li",[r("a",{attrs:{href:"https://github.com/vuejs/vue-cli/tree/dev/packages/%40vue/cli-plugin-babel",target:"_blank",rel:"noopener"}},[e._v("babel")])]),r("li",[r("a",{attrs:{href:"https://github.com/vuejs/vue-cli/tree/dev/packages/%40vue/cli-plugin-eslint",target:"_blank",rel:"noopener"}},[e._v("eslint")])])])},function(){var e=this,t=e.$createElement,r=e._self._c||t;return r("ul",[r("li",[r("a",{attrs:{href:"https://vuejs.org",target:"_blank",rel:"noopener"}},[e._v("Core Docs")])]),r("li",[r("a",{attrs:{href:"https://forum.vuejs.org",target:"_blank",rel:"noopener"}},[e._v("Forum")])]),r("li",[r("a",{attrs:{href:"https://chat.vuejs.org",target:"_blank",rel:"noopener"}},[e._v("Community Chat")])]),r("li",[r("a",{attrs:{href:"https://twitter.com/vuejs",target:"_blank",rel:"noopener"}},[e._v("Twitter")])]),r("li",[r("a",{attrs:{href:"https://news.vuejs.org",target:"_blank",rel:"noopener"}},[e._v("News")])])])},function(){var e=this,t=e.$createElement,r=e._self._c||t;return r("ul",[r("li",[r("a",{attrs:{href:"https://router.vuejs.org",target:"_blank",rel:"noopener"}},[e._v("vue-router")])]),r("li",[r("a",{attrs:{href:"https://vuex.vuejs.org",target:"_blank",rel:"noopener"}},[e._v("vuex")])]),r("li",[r("a",{attrs:{href:"https://github.com/vuejs/vue-devtools#vue-devtools",target:"_blank",rel:"noopener"}},[e._v("vue-devtools")])]),r("li",[r("a",{attrs:{href:"https://vue-loader.vuejs.org",target:"_blank",rel:"noopener"}},[e._v("vue-loader")])]),r("li",[r("a",{attrs:{href:"https://github.com/vuejs/awesome-vue",target:"_blank",rel:"noopener"}},[e._v("awesome-vue")])])])}],y={name:"HelloWorld",props:{msg:String}},A=y,j=(r("4805"),Object(p["a"])(A,w,k,!1,null,"b9167eee",null)),E=j.exports,O={name:"Home",components:{HelloWorld:E}},S=O,H=Object(p["a"])(S,b,g,!1,null,null,null),M=H.exports,C=function(){var e=this,t=e.$createElement,r=e._self._c||t;return r("div",{staticClass:"about",on:{"&wheel":function(t){return e.wheel2home(t)}}},[r("div",{attrs:{id:"wrapper"}},[r("div",{staticClass:"about-workspace"},[r("div",{attrs:{id:"spacer"}}),r("div",{attrs:{id:"spacer"}}),e._m(0),e._m(1),r("div",{attrs:{id:"spacer"}}),r("router-link",{attrs:{to:"/title"}},[r("button",{attrs:{id:"home-button"}},[e._v("GO HOME")])])],1)])])},P=[function(){var e=this,t=e.$createElement,r=e._self._c||t;return r("div",{attrs:{id:"header"}},[e._v(" About Me "),r("span",{staticStyle:{color:"#9f536b"}},[e._v(".")])])},function(){var e=this,t=e.$createElement,r=e._self._c||t;return r("div",{attrs:{id:"about-body"}},[e._v(" Hey there! My name is "),r("strong",[e._v("Vishnu Rengaraj")]),e._v(". I'm currently a "),r("strong",[e._v("graduate student")]),e._v(" at the University of Michigan studying computational mechanics. This summer I'm "),r("strong",[e._v("moving")]),e._v(" from Michigan to California to work at "),r("strong",[e._v("SpaceX")]),e._v(" as a development test engineer. "),r("br"),e._v(" --- ")])}],x={name:"about",components:{},data:function(){return{scrolled:!1}},methods:{wheel2home:function(e){e.deltaY<0&&0==this.scrolled&&(this.scrolled=!0,this.$router.push({name:"Title"}))}}},J=x,R=(r("9350"),Object(p["a"])(J,C,P,!1,null,"40f7da00",null)),$=R.exports,T=function(){var e=this,t=e.$createElement,r=e._self._c||t;return r("div",{staticClass:"resume"},[r("div",{attrs:{id:"spacer"}}),r("transition",{attrs:{name:"fade"}},[r("div",{attrs:{id:"header"}},[e._v(" Resume "),r("span",{staticStyle:{color:"#9f536b"}},[e._v(".")])])]),r("div",{attrs:{id:"spacer"}}),r("router-link",{attrs:{to:"/title"}},[r("button",{attrs:{id:"goHome"}},[e._v("GO HOME")])]),r("img",{attrs:{src:"https://upload.wikimedia.org/wikipedia/commons/2/28/Chocolate_Hills_overview.JPG"}}),r("img",{attrs:{src:"https://upload.wikimedia.org/wikipedia/commons/2/28/Chocolate_Hills_overview.JPG"}})],1)},I=[],z={name:"Resume"},K=z,B=(r("9c7f"),Object(p["a"])(K,T,I,!1,null,"e9876c8e",null)),G=B.exports,Q=function(){var e=this,t=e.$createElement,n=e._self._c||t;return n("div",{staticClass:"title",on:{"&wheel":function(t){return e.wheelson(t)}}},[n("div",{attrs:{id:"wrapper"}},[n("vue-particles",{attrs:{color:"#587792",particleOpacity:1,particlesNumber:38,shapeType:"circle",particleSize:9,linesColor:"8db1ab",linesWidth:2,lineLinked:!0,lineOpacity:1,linesDistance:170,moveSpeed:.75,hoverEffect:!0,hoverMode:"grab",clickEffect:!0,clickMode:"push"}}),n("div",{attrs:{id:"text"}},[n("div",{attrs:{id:"first"}},[e._v("Vishnu")]),n("div",{attrs:{id:"last"}},[e._v("Rengaraj")]),n("div",{attrs:{id:"subtitle"}},[e._v(e._s(e.whois[0]))])]),n("router-link",{attrs:{to:{name:"Home2About"}}},[n("div",{attrs:{id:"open-about-text"}},[e._v("learn more")]),n("button",{attrs:{id:"open-about-button"}},[n("img",{attrs:{src:r("5cec")}})])])],1)])},V=[],W=(r("99af"),{name:"title",components:{},data:function(){return{scrolled:!1,whois:["Mechanical Engineer","Computer Scientist","Graduate Student","Designer","Stress Analyst","Banana Lover"]}},mounted:function(){var e=this;window.setInterval((function(){e.pollPerson()}),2700)},methods:{clear:function(){this.scrolled=!1},wheelson:function(e){e.deltaY>0&&0==this.scrolled&&(this.scrolled=!0,this.$router.push({name:"Home2About"}))},pollPerson:function(){var e=this.whois.shift();this.whois=this.whois.concat(e)}}}),L=W,Z=(r("d251"),Object(p["a"])(L,Q,V,!1,null,"521592c8",null)),N=Z.exports;n["default"].use(_["a"]);var D=[{path:"/",name:"Home",component:M},{path:"/about",name:"About2Home",meta:{transition:"overlay-down-full"},component:$},{path:"/about",name:"Home2About",meta:{transition:"overlay-up-full"},component:$},{path:"/title",name:"Title",meta:{transition:"overlay-down-full"},component:N},{path:"/resume",name:"Resume2Home",meta:{transition:"overlay-up-full"},component:G},{path:"/resume",name:"Home2Resume",meta:{transition:"overlay-down-full"},component:G}],F=new _["a"]({routes:D}),U=F;n["default"].use(s.a),n["default"].use(i["a"]),n["default"].use(u.a),n["default"].use(c["default"]),n["default"].config.productionTip=!1,new n["default"]({router:U,render:function(e){return e(h)}}).$mount("#app")},"5c0b":function(e,t,r){"use strict";var n=r("9c0c"),o=r.n(n);o.a},"5cec":function(e,t){e.exports="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAQAAABIkb+zAAAA+klEQVR42u3RSQ7CMBAFUdZOzshVcjJm7lVsWAAKzoRwt1RvbbV+ybudJEmSJEmSJEmS0mBP+cmdwr7F/AE4bE+gcACGFvMBjtsSKByfl4YW8zcmvMz/Z8LbfIDTugQKp49LQ4v5KxNG5v8nYTRgccKX+Q3/AM50sy90nJvN357QfH4l4TKdQMel+fz1CWHmr0sINb+ScB1PoOMaav6yhJDzKwk3+rdXPbeQ8+clhJ4/nRB+fiXhTk/PPfz8akKO+ZWELPMXJESdPzMh8vwZCdHnTyRkmF9JyDL/S0Km+SMJ2eZ/JGSc/5KQdf4zIfN8SZIkSZIkSZIU0gPQ3AKVOIhG/wAAAABJRU5ErkJggg=="},7599:function(e,t,r){},"8ce0":function(e,t,r){},9350:function(e,t,r){"use strict";var n=r("d5df"),o=r.n(n);o.a},"9c0c":function(e,t,r){},"9c7f":function(e,t,r){"use strict";var n=r("7599"),o=r.n(n);o.a},c88d:function(e,t,r){},cf05:function(e,t,r){e.exports=r.p+"img/logo.82b9c7a5.png"},d251:function(e,t,r){"use strict";var n=r("c88d"),o=r.n(n);o.a},d5df:function(e,t,r){}});
//# sourceMappingURL=app.57944b22.js.map
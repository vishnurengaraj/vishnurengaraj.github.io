(function(t){function e(e){for(var i,o,r=e[0],d=e[1],l=e[2],u=0,m=[];u<r.length;u++)o=r[u],Object.prototype.hasOwnProperty.call(n,o)&&n[o]&&m.push(n[o][0]),n[o]=0;for(i in d)Object.prototype.hasOwnProperty.call(d,i)&&(t[i]=d[i]);c&&c(e);while(m.length)m.shift()();return s.push.apply(s,l||[]),a()}function a(){for(var t,e=0;e<s.length;e++){for(var a=s[e],i=!0,r=1;r<a.length;r++){var d=a[r];0!==n[d]&&(i=!1)}i&&(s.splice(e--,1),t=o(o.s=a[0]))}return t}var i={},n={app:0},s=[];function o(e){if(i[e])return i[e].exports;var a=i[e]={i:e,l:!1,exports:{}};return t[e].call(a.exports,a,a.exports,o),a.l=!0,a.exports}o.m=t,o.c=i,o.d=function(t,e,a){o.o(t,e)||Object.defineProperty(t,e,{enumerable:!0,get:a})},o.r=function(t){"undefined"!==typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(t,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(t,"__esModule",{value:!0})},o.t=function(t,e){if(1&e&&(t=o(t)),8&e)return t;if(4&e&&"object"===typeof t&&t&&t.__esModule)return t;var a=Object.create(null);if(o.r(a),Object.defineProperty(a,"default",{enumerable:!0,value:t}),2&e&&"string"!=typeof t)for(var i in t)o.d(a,i,function(e){return t[e]}.bind(null,i));return a},o.n=function(t){var e=t&&t.__esModule?function(){return t["default"]}:function(){return t};return o.d(e,"a",e),e},o.o=function(t,e){return Object.prototype.hasOwnProperty.call(t,e)},o.p="/";var r=window["webpackJsonp"]=window["webpackJsonp"]||[],d=r.push.bind(r);r.push=e,r=r.slice();for(var l=0;l<r.length;l++)e(r[l]);var c=d;s.push([0,"chunk-vendors"]),a()})({0:function(t,e,a){t.exports=a("56d7")},"0097":function(t,e,a){"use strict";var i=a("3027"),n=a.n(i);n.a},"00ea":function(t,e,a){"use strict";var i=a("2f1a"),n=a.n(i);n.a},"014a":function(t,e,a){"use strict";var i=a("cd43"),n=a.n(i);n.a},"196f":function(t,e,a){},"1b40":function(t,e,a){},"2dfb":function(t,e,a){"use strict";var i=a("1b40"),n=a.n(i);n.a},"2f1a":function(t,e,a){},3027:function(t,e,a){},3823:function(t,e,a){},"3bb3":function(t,e,a){},"49ee":function(t,e,a){},"56d7":function(t,e,a){"use strict";a.r(e);a("e260"),a("e6cf"),a("cca6"),a("a79d"),a("0cdd");var i=a("2b0e"),n=a("5f5b");a("ab8b"),a("2dd8");i["default"].use(n["a"]);var s=a("43f9"),o=a.n(s),r=(a("51de"),a("e094"),a("98c9")),d=a("c0eb"),l=a("7cf2"),c=a("ce5b"),u=a.n(c),m=(a("bf40"),a("0086")),h=a.n(m),p=a("f0eb"),g=function(){var t=this,e=t.$createElement,a=t._self._c||e;return a("v-app",[a("v-main",[a("router-view")],1)],1)},v=[],f={name:"App",data:function(){return{}}},b=f,w=(a("0097"),a("2877")),_=a("6544"),y=a.n(_),C=a("7496"),k=a("f6c4"),A=Object(w["a"])(b,g,v,!1,null,"47099526",null),S=A.exports;y()(A,{VApp:C["a"],VMain:k["a"]});var j=a("8c4f"),L=function(){var t=this,e=t.$createElement,a=t._self._c||e;return a("hello-world")},D=[],x=function(){var t=this,e=t.$createElement,i=t._self._c||e;return i("v-container",[i("v-row",{staticClass:"text-center"},[i("v-col",{attrs:{cols:"12"}},[i("v-img",{staticClass:"my-3",attrs:{src:a("9b19"),contain:"",height:"200"}})],1),i("v-col",{staticClass:"mb-4"},[i("h1",{staticClass:"display-2 font-weight-bold mb-3"},[t._v(" Welcome to Vuetify ")]),i("p",{staticClass:"subheading font-weight-regular"},[t._v(" For help and collaboration with other Vuetify developers, "),i("br"),t._v("please join our online "),i("a",{attrs:{href:"https://community.vuetifyjs.com",target:"_blank"}},[t._v("Discord Community")])])]),i("v-col",{staticClass:"mb-5",attrs:{cols:"12"}},[i("h2",{staticClass:"headline font-weight-bold mb-3"},[t._v(" What's next? ")]),i("v-row",{attrs:{justify:"center"}},t._l(t.whatsNext,(function(e,a){return i("a",{key:a,staticClass:"subheading mx-3",attrs:{href:e.href,target:"_blank"}},[t._v(" "+t._s(e.text)+" ")])})),0)],1),i("v-col",{staticClass:"mb-5",attrs:{cols:"12"}},[i("h2",{staticClass:"headline font-weight-bold mb-3"},[t._v(" Important Links ")]),i("v-row",{attrs:{justify:"center"}},t._l(t.importantLinks,(function(e,a){return i("a",{key:a,staticClass:"subheading mx-3",attrs:{href:e.href,target:"_blank"}},[t._v(" "+t._s(e.text)+" ")])})),0)],1),i("v-col",{staticClass:"mb-5",attrs:{cols:"12"}},[i("h2",{staticClass:"headline font-weight-bold mb-3"},[t._v(" Ecosystem ")]),i("v-row",{attrs:{justify:"center"}},t._l(t.ecosystem,(function(e,a){return i("a",{key:a,staticClass:"subheading mx-3",attrs:{href:e.href,target:"_blank"}},[t._v(" "+t._s(e.text)+" ")])})),0)],1)],1)],1)},I=[],R={name:"HelloWorld",data:function(){return{ecosystem:[{text:"vuetify-loader",href:"https://github.com/vuetifyjs/vuetify-loader"},{text:"github",href:"https://github.com/vuetifyjs/vuetify"},{text:"awesome-vuetify",href:"https://github.com/vuetifyjs/awesome-vuetify"}],importantLinks:[{text:"Documentation",href:"https://vuetifyjs.com"},{text:"Chat",href:"https://community.vuetifyjs.com"},{text:"Made with Vuetify",href:"https://madewithvuejs.com/vuetify"},{text:"Twitter",href:"https://twitter.com/vuetifyjs"},{text:"Articles",href:"https://medium.com/vuetify"}],whatsNext:[{text:"Explore components",href:"https://vuetifyjs.com/components/api-explorer"},{text:"Select a layout",href:"https://vuetifyjs.com/getting-started/pre-made-layouts"},{text:"Frequently Asked Questions",href:"https://vuetifyjs.com/getting-started/frequently-asked-questions"}]}}},E=R,M=a("62ad"),W=a("a523"),T=a("adda"),V=a("0fd9"),O=Object(w["a"])(E,x,I,!1,null,null,null),P=O.exports;y()(O,{VCol:M["a"],VContainer:W["a"],VImg:T["a"],VRow:V["a"]});var z={name:"Home",components:{HelloWorld:P}},G=z,U=Object(w["a"])(G,L,D,!1,null,null,null),N=U.exports,B=function(){var t=this,e=t.$createElement,a=t._self._c||e;return a("div",{staticClass:"about"},[a("div",{attrs:{id:"wrapper"}},[a("div",{staticClass:"about-workspace"},[a("div",{attrs:{id:"spacer"}}),a("div",{attrs:{id:"header"}},[t._v("About Me")]),t._m(0),a("Timeline"),a("div",{attrs:{id:"spacer"}}),a("div",{attrs:{id:"spacer"}}),a("div",{attrs:{id:"header"}},[t._v("Projects")]),a("Project"),a("div",{attrs:{id:"spacer"}}),a("div",{attrs:{id:"spacer"}}),a("div",{attrs:{id:"header"}},[t._v("Resume")]),a("Resume")],1)])])},q=[function(){var t=this,e=t.$createElement,a=t._self._c||e;return a("div",{attrs:{id:"about-body"}},[t._v(" Hey there! My name is "),a("strong",[t._v("Vishnu Rengaraj")]),t._v(". I'm currently a "),a("strong",[t._v("graduate student")]),t._v(" at the University of Michigan studying computational mechanics. This summer I'm "),a("strong",[t._v("moving")]),t._v(" from Michigan to California to work at "),a("strong",[t._v("SpaceX")]),t._v(" as a development test engineer. Here are some recent milestones: "),a("br"),t._v(" --- ")])}],F=function(){var t=this,e=t.$createElement,a=t._self._c||e;return a("div",{staticClass:"timeline"},[a("vue-timeline-update",{attrs:{date:new Date("2021-05-31"),title:"SpaceX - Test Development",description:"TBD... ",category:"Full time",icon:"check",color:"red"}}),a("vue-timeline-update",{attrs:{date:new Date("2020-09-01"),title:"University of Michigan",description:"M.S.E in Mechanical Engineering with an emphasis in computational mechanics",category:"graduate school",icon:"school",color:"turquoise"}}),a("vue-timeline-update",{attrs:{date:new Date("2020-05-14"),title:"SpaceX - Test Development",description:"Design novel test equipment for quick and accurate aerospace qualification",category:"internship",icon:"work",color:"purple"}}),a("vue-timeline-update",{attrs:{date:new Date("2019-05-28"),title:"Tesla - Body Design",description:"Design, validate, and manage structural body components through their lifecycle",category:"internship",icon:"work",color:"purple"}}),a("vue-timeline-update",{attrs:{date:new Date("2016-09-01"),title:"University of Michigan",description:"B.S.E in Mechanical Engineering with a minor in Computer Science",category:"undergraduate school",icon:"school",color:"turquoise","is-last":""}})],1)},H=[],$={name:"timeline"},J=$,Q=(a("d083"),Object(w["a"])(J,F,H,!1,null,"c3b5927a",null)),K=Q.exports,X=function(){var t=this,e=t.$createElement,a=t._self._c||e;return a("div",{staticClass:"project"},t._l(t.projects,(function(t,e){return a("pcard",{key:e,attrs:{"v:bind:project":"project",imageURL:t.imageURL,imageDescription:t.imageDescription,title:t.title,subtitle:t.subtitle,body:t.body,buttonName:t.buttonName,buttonLink:t.buttonLink,isVideo:t.isVideo}})})),1)},Z=[],Y=function(){var t=this,e=t.$createElement,a=t._self._c||e;return a("div",{staticClass:"project-card"},[a("div",[a("md-card",{attrs:{"md-with-hover":""}},[t.windowWidth<750?a("md-card-media",{attrs:{"md-big":""}},[t.isVideo?t._e():a("div",[a("img",{attrs:{src:t.imageURL,alt:t.imageDescription}})]),t.isVideo?a("div",[a("video",{attrs:{autoplay:"",loop:"",muted:"",playsinline:""},domProps:{muted:!0}},[a("source",{attrs:{src:t.imageURL,alt:t.imageDescription,type:"video/mp4"}})])]):t._e()]):t._e(),a("md-card-header",[a("md-card-header-text",[a("div",{staticClass:"md-title"},[t._v(t._s(t.title))]),a("div",{staticClass:"md-subhead"},[t._v(t._s(t.subtitle))]),t.windowWidth>=750?a("md-card-content",[t._v(" "+t._s(t.body)+" ")]):t._e()],1),t.windowWidth>=750?a("md-card-media",{attrs:{"md-big":""}},[t.isVideo?t._e():a("div",[a("img",{attrs:{src:t.imageURL,alt:t.imageDescription}})]),t.isVideo?a("div",[a("video",{attrs:{autoplay:"",loop:"",muted:"",playsinline:""},domProps:{muted:!0}},[a("source",{attrs:{src:t.imageURL,alt:t.imageDescription,type:"video/mp4"}})])]):t._e()]):t._e()],1),t.windowWidth>=750?a("md-card-actions",[a("md-button",{staticClass:"pill",attrs:{href:t.buttonLink,target:"_blank"}},[a("strong",[t._v(t._s(t.buttonName))])])],1):t._e(),t.windowWidth<750?a("md-card-expand",[a("md-card-actions",{attrs:{"md-alignment":"space-between"}},[a("div",[a("md-button",{staticClass:"pill",attrs:{href:t.buttonLink,target:"_blank"}},[a("strong",[t._v(t._s(t.buttonName))])])],1),a("md-card-expand-trigger",[a("md-button",{staticClass:"md-icon-button"},[a("strong",[a("md-icon",[t._v("keyboard_arrow_down")])],1)])],1)],1),a("md-card-expand-content",[a("md-card-content",[t._v(" "+t._s(t.body)+" ")])],1)],1):t._e()],1)],1)])},tt=[],et={name:"project-card",props:["imageURL","imageDescription","title","subtitle","body","buttonName","buttonLink","isVideo"],components:{},data:function(){return{windowWidth:window.innerWidth}},mounted:function(){var t=this;window.addEventListener("resize",(function(){t.windowWidth=window.innerWidth}))},methods:{}},at=et,it=(a("cbec"),Object(w["a"])(at,Y,tt,!1,null,"1e0ce31a",null)),nt=it.exports,st={name:"project",components:{pcard:nt},data:function(){return{projects:[{imageURL:"../assets/final-spectrogram.png",imageDescription:"Spectrogram results of our model output as well as the low res input and high res goal",title:"Audio Upscaling with Deep Learning",subtitle:"Frequency fused residual convolutional network to resolve high frequency data",body:"and when she went back to the table for it, she found she could not possibly reach it: she could see it quite plainly through the glass, and she tried her best to climb up one of the legs of the table, but it was too slippery; and when she had tired herself out with trying, the poor little thing sat down and cried. After a while, finding that nothing more happened, she decided on going into the garden at once; but, alas for poor Alice! when she got to the door, she found she had forgotten the little golden key, and when she went back to the table for it, ",buttonName:"Paper",buttonLink:"../assets/Audio_Upscaling.pdf",isVideo:!1},{imageURL:"../assets/FEAshnu_res_1.png",imageDescription:"Actual and predicted displacement contours in X and Y directions from given forcing",title:"Solving Boundary Value Problems with Machine Learning",subtitle:"Real-time finite element analysis prediction with convolutional neural network",body:"and when she went back to the table for it, she found she could not possibly reach it: she could see it quite plainly through the glass, and she tried her best to climb up one of the legs of the table, but it was too slippery; and when she had tired herself out with trying, the poor little thing sat down and cried. After a while, finding that nothing more happened, she decided on going into the garden at once; but, alas for poor Alice! when she got to the door, she found she had forgotten the little golden key, and when she went back to the table for it, ",buttonName:"Presentation",buttonLink:"../assets/FEA_CNN.pdf",isVideo:!1},{imageURL:"../assets/baja_crash.gif",imageDescription:"Frontal impact crash simulation in RADIOSS",title:"Baja SAE Full Vehicle Crash Simulation",subtitle:"Explicit finite element simulation via RADIOSS of Baja vehcile under different crashing scenarios",body:"and when she went back to the table for it, she found she could not possibly reach it: she could see it quite plainly through the glass, and she tried her best to climb up one of the legs of the table, but it was too slippery; and when she had tired herself out with trying, the poor little thing sat down and cried. After a while, finding that nothing more happened, she decided on going into the garden at once; but, alas for poor Alice! when she got to the door, she found she had forgotten the little golden key, and when she went back to the table for it, ",buttonName:"Article",buttonLink:"../assets/Baja_Article.pdf",isVideo:!1}]}},mounted:function(){var t=this;window.addEventListener("resize",(function(){t.windowWidth=window.innerWidth}))},methods:{}},ot=st,rt=(a("ea51"),Object(w["a"])(ot,X,Z,!1,null,"41c88910",null)),dt=rt.exports,lt=function(){var t=this,e=t.$createElement,a=t._self._c||e;return a("div",{staticClass:"resume"},[a("v-card",{attrs:{color:"color","sticky-container":""}},[a("v-tabs",{attrs:{"background-color":"transparent",color:"color",grow:"","center-active":"","show-arrows":""},model:{value:t.tab,callback:function(e){t.tab=e},expression:"tab"}},t._l(t.items,(function(e){return a("v-tab",{key:e},[a("span",{staticStyle:{"font-weight":"600"}},[a("strong",[t._v(t._s(e))])])])})),1),a("v-tabs-items",{model:{value:t.tab,callback:function(e){t.tab=e},expression:"tab"}},[a("v-tab-item",[a("v-card",{attrs:{color:"color",flat:""}},[a("ResumeExperience")],1)],1),a("v-tab-item",[a("v-card",{attrs:{color:"color",flat:""}},[a("ResumeEdu")],1)],1),a("v-tab-item",[a("v-card",{attrs:{color:"color",flat:""}},[a("ResumeClub")],1)],1),a("v-tab-item",[a("v-card",{attrs:{color:"color",flat:""}},[a("ResumeAward")],1)],1)],1)],1)],1)},ct=[],ut=function(){var t=this,e=t.$createElement,a=t._self._c||e;return a("div",{staticClass:"resume-edu"},t._l(t.edus,(function(t,e){return a("rbcard",{key:e,attrs:{"v:bind:edu":"edu",imageURL:t.imageURL,imageDescription:t.imageDescription,title:t.title,subtitle:t.subtitle,gpa:t.gpa,date:t.date,buttonName:t.buttonName,buttonLink:t.buttonLink,includeGpa:t.includeGpa}})})),1)},mt=[],ht=function(){var t=this,e=t.$createElement,a=t._self._c||e;return a("div",{staticClass:"card-template"},[a("md-card",[a("md-card-header",[a("div",{staticClass:"md-title"},[t._v(" "+t._s(t.title)),a("span",{staticClass:"date-style"},[a("strong",[t._v(t._s(t.date))])])]),a("div",{staticClass:"md-subhead"},[a("strong",[t._v(t._s(t.subtitle))])]),t.includeGpa?a("div",{staticClass:"md-subhead"},[a("strong",[t._v("GPA: "+t._s(t.gpa))])]):t._e()]),a("md-card-media",[a("img",{attrs:{src:t.imageURL,alt:t.imageDescription}})]),a("md-button",{attrs:{href:t.buttonLink,target:"_blank","md-alignment":"left"}},[a("strong",[t._v(t._s(t.buttonName))])])],1)],1)},pt=[],gt={name:"card-template",props:["imageURL","imageDescription","title","subtitle","gpa","date","buttonName","buttonLink","includeGpa"],components:{},data:function(){return{windowWidth:window.innerWidth}},mounted:function(){var t=this;window.addEventListener("resize",(function(){t.windowWidth=window.innerWidth}))},methods:{}},vt=gt,ft=(a("e426"),Object(w["a"])(vt,ht,pt,!1,null,"2098c98b",null)),bt=ft.exports,wt={name:"resume-edu",components:{rbcard:bt},data:function(){return{edus:[{imageURL:"https://news.umich.edu/wp-content/uploads/2015/11/a-tour-of-u-michigan-s-new-mechanical-engineering-research-complex-orig-20151116.jpg",imageDescription:"Shiba Inu",title:"University of Michigan",subtitle:"MSE: Mechanical Engineering | Focus: Computational Mechanics",gpa:"4.00",date:"2020-2021",buttonName:"Website",buttonLink:"https://masters.engin.umich.edu/degree/mechanical-engineering-mse/",includeGpa:!0},{imageURL:"https://vishnurengaraj.github.io/IMG_20180908_114534.jpg",imageDescription:"Shiba Inu",title:"University of Michigan",subtitle:"BSE: Mechanical Engineering | Minor: Computer Science",gpa:"3.83",date:"2016-2020",buttonName:"Website",buttonLink:"https://www.engin.umich.edu/",includeGpa:!0},{imageURL:"https://oakland.edu/Assets/uploads/images/CampusScene118.png",imageDescription:"Shiba Inu",title:"Oakland University",subtitle:"Mathematics | During Highschool",gpa:"3.87",date:"2015-2016",buttonName:"Website",buttonLink:"https://oakland.edu/",includeGpa:!0},{title:"Rochester Adams Highschool",gpa:"4.23 (weighted)",date:"2012-2016",buttonName:"Website",buttonLink:"https://ahs.rochester.k12.mi.us/",includeGpa:!0}]}},mounted:function(){var t=this;window.addEventListener("resize",(function(){t.windowWidth=window.innerWidth}))},methods:{}},_t=wt,yt=(a("8259"),Object(w["a"])(_t,ut,mt,!1,null,"6c811121",null)),Ct=yt.exports,kt=function(){var t=this,e=t.$createElement,a=t._self._c||e;return a("div",{staticClass:"resume-award"},t._l(t.awards,(function(t,e){return a("rbcard",{key:e,attrs:{"v:bind:award":"award",imageURL:t.imageURL,imageDescription:t.imageDescription,title:t.title,subtitle:t.subtitle,gpa:t.gpa,date:t.date,buttonName:t.buttonName,buttonLink:t.buttonLink,includeGpa:t.includeGpa}})})),1)},At=[],St={name:"resume-award",components:{rbcard:bt},data:function(){return{awards:[{title:"R&B Machine Tool Company Scholarship",date:"2020",buttonName:"Details",buttonLink:"https://me.engin.umich.edu/news-events/news/me-students-receive-me-departmental-awards-0",includeGpa:!1},{title:"Ford Vehicle Design Team Scholarship",date:"2017,2018",buttonName:"Details",buttonLink:"https://www.fordfund.org/education",includeGpa:!1},{title:"FCA Student Achievement Scholarship",date:"2017",includeGpa:!1},{title:"William J. Branstrom Freshman Prize",subtitle:"Top 5% of First Year Students",date:"2017",buttonName:"Details",buttonLink:"https://umich-regoff.custhelp.com/app/answers/detail/a_id/1303/~/william-j.-branstrom-freshman-prize-criteria",includeGpa:!1},{title:"James B. Angell Scholar",subtitle:"Consecutive semesters of only A’s",date:"2018",buttonName:"Details",buttonLink:"https://webapps.lsa.umich.edu/academicsrequirements2013/honorsawards/universityhonors/angellscholars/index.html",includeGpa:!1},{title:"University of Michigan Honors & Dean's List",date:"2016-2018",buttonName:"Details",buttonLink:"https://studentawards.engin.umich.edu/deanslist/",includeGpa:!1},{title:"FIRST Robotics Dean’s List Finalist",date:"2015",includeGpa:!1}]}},mounted:function(){var t=this;window.addEventListener("resize",(function(){t.windowWidth=window.innerWidth}))},methods:{}},jt=St,Lt=(a("aafd"),Object(w["a"])(jt,kt,At,!1,null,"3963f2d1",null)),Dt=Lt.exports,xt=function(){var t=this,e=t.$createElement,a=t._self._c||e;return a("div",{staticClass:"resume-club"},[a("div",{staticClass:"card-template"},[a("md-card",[a("md-card-header",[a("div",{staticClass:"md-title"},[t._v(" "+t._s(t.data[0][0])),a("span",{staticClass:"date-style"},[a("strong",[t._v(t._s(t.data[0][1]))])])]),a("div",{staticClass:"md-subhead"},[a("strong",[t._v(t._s(t.data[0][2]))])])]),a("md-card-media",[a("img",{attrs:{src:t.data[0][3],alt:t.data[0][4]}})]),a("md-card-content",[a("div",{staticClass:"md-subhead"},[a("strong",[t._v("About the club")])]),t._v(" "+t._s(t.data[0][5])),a("br"),a("br"),a("div",{staticClass:"md-subhead"},[a("strong",[t._v("What I did")])]),a("ul",[a("li",[t._v("Testing & Validation Director "),a("em",[t._v("(2018 - 2020)")])]),a("ul",[a("li",[t._v(" Collected testing data via strain gages, rpm sensors, potentiometers, and accelerometers ")]),a("li",[t._v(" Implemented implicit linear static and non-linear quasi-static simulations for stiffness and strain calculations ")]),a("li",[t._v(" Developed scripts to automate material, property, and loadcase definitions w/ one-click tetra-meshing ")]),a("li",[t._v(" Introduced topology optimization reducing transmission rotational inertia by 30% and overall weight by ~8lbs ")]),a("li",[t._v(" Applied high performance computing (HPC) to decrease turnaround time by 10x ")])]),a("li",[t._v("Suspension Structures Lead "),a("em",[t._v("(2018 - 2020)")])]),a("ul",[a("li",[t._v(" Redesigned Front lower control arm (FLCA) to reduce part count from 8 -> 5 , reduce weight by 0.5lb per link, and increase impact toughness ")]),a("li",[t._v(" Improved Rear upper link (H-Arm) durability by collecting rear suspension loads and applying them to a topology optimization to solve for abuse loading while minimizing mass ")])]),a("li",[t._v("Chassis Lead "),a("em",[t._v("(2017 - 2018)")])]),a("ul",[a("li",[t._v(" Simulated full vehicle crash w/ optimization via RADIOSS and OptiStruct to design safer roll cage ")]),a("li",[t._v(" Validated simulations by conducted Instron testing and correlating results ")]),a("li",[t._v(" Verified torsional stiffness with static analysis and then real-world deflection tests ")])]),a("li",[t._v("Mill, Lathe, and CNC Mill certified")])])]),a("md-button",{attrs:{href:t.data[0][7],target:"_blank","md-alignment":"left"}},[a("strong",[t._v("Details")])])],1),a("md-card",[a("md-card-header",[a("div",{staticClass:"md-title"},[t._v(" "+t._s(t.data[1][0])),a("span",{staticClass:"date-style"},[a("strong",[t._v(t._s(t.data[1][1]))])])]),a("div",{staticClass:"md-subhead"},[a("strong",[t._v(t._s(t.data[1][2]))])])]),a("md-card-media",[a("img",{attrs:{src:t.data[1][3],alt:t.data[1][4]}})]),a("md-card-content",[a("div",{staticClass:"md-subhead"},[a("strong",[t._v("About the club")])]),t._v(" "+t._s(t.data[1][5])),a("br"),a("br"),a("div",{staticClass:"md-subhead"},[a("strong",[t._v("What I did")])]),t._v(" I've been a part of first robotics since 4th grade and had a passion for it ever since. I joined the Adambots, team 245, in 9th grade and continued all through my high school years. As I gained experience, I moved up in the team starting as a general member then to a team lead and finally to team captain. Additionally, I was the primary driver of the robot for three years which exposed me to other teams and engineers from other states and countries."),a("br"),a("br"),t._v(" A specific component I am proud of is the catapult I designed my senior year. The challenge was to shoot a dodgeball into a small opening in a tower. Most of other teams used a flywheel shooter which was only accurate at close ranges. My catapult could shoot at any fixed range and ultimately was the key to winning the Cincinnati regional competition. ")]),a("md-button",{attrs:{href:t.data[1][7],target:"_blank","md-alignment":"left"}},[a("strong",[t._v("Details")])])],1)],1)])},It=[],Rt={name:"resume-club",components:{},data:function(){return{windowWidth:window.innerWidth,data:[["Michigan Baja Racing","2016-2020","Director of Testing & Validation | Previously: Suspension Lead, Chassis Lead","https://vishnurengaraj.github.io/bajaCar.jpg","2019 Michigan Baja SAE car","Michigan Baja is a student engineering team tasked with designing, building, and testing a single seater off-road vehicle to compete against other collegiate teams. We routinely place in the top 3 at every competition due to our commitment to a lightweight, durable design.","Some accomplishments I've made on the team are:","https://www.michiganbajaracing.com/"],["FIRST Robotics","2012-2016","Team Captain | Mechanical Lead | Fabrication Lead","https://vishnurengaraj.github.io/robot.jpg","2016 Adambots Robot",'Under strict rules, limited resources, and an intense six-week time limit, teams of students are challenged to raise funds, design a team "brand," hone teamwork skills, and build and program industrial-size robots to play a difficult field game against like-minded competitors.',"Some accomplishments I've made on the team are:","https://www.adambots.com/"]]}},mounted:function(){var t=this;window.addEventListener("resize",(function(){t.windowWidth=window.innerWidth}))},methods:{}},Et=Rt,Mt=(a("2dfb"),Object(w["a"])(Et,xt,It,!1,null,"73bcd567",null)),Wt=Mt.exports,Tt=function(){var t=this,e=t.$createElement,a=t._self._c||e;return a("div",{staticClass:"resume-experience"},[a("div",{staticClass:"card-template"},[a("md-card",[a("md-card-header",[a("div",{staticClass:"md-title"},[t._v(" "+t._s(t.data[0][0])),a("span",{staticClass:"date-style"},[a("strong",[t._v(t._s(t.data[0][1]))])])]),a("div",{staticClass:"md-subhead"},[a("strong",[t._v(t._s(t.data[0][2]))])])]),a("md-card-media",[a("img",{attrs:{src:t.data[0][3],alt:t.data[0][4]}})]),a("md-card-content",[a("div",{staticClass:"md-subhead"},[a("strong",[t._v("About the company")])]),t._v(" "+t._s(t.data[0][5])),a("br"),a("br"),a("div",{staticClass:"md-subhead"},[a("strong",[t._v("What I did")])]),a("ul",[a("li",[a("strong",[t._v("Development Test Intern")]),t._v(": Design novel test equipment for quick and accurate aerospace qualification ")]),a("ul",[a("li",[t._v(" Successfully designed, manufactured, and tested 25 ft. long high pressure gas cannon for FAA bird strike testing ")]),a("ul",[a("li",[t._v(" Created detailed fluids model in Python with fully modeled interactions based on flow fundamentals ")]),a("li",[t._v(" Generated drawings (GD&T) + fluid schematics and worked with suppliers to manufacture cannon ")]),a("li",[t._v(" Coordinated assembly of fluid system, DAQ, projectiles, and other critical infrastructure ")])]),a("li",[t._v(" Designed and analyzed actuator assemblies on short timeline for critical path parts ")]),a("li",[t._v(" Documented and researched environmental testing and sorted conditions on importance ")])])])]),a("md-button",{attrs:{href:t.data[0][7],target:"_blank","md-alignment":"left"}},[a("strong",[t._v("Details")])])],1),a("md-card",[a("md-card-header",[a("div",{staticClass:"md-title"},[t._v(" "+t._s(t.data[1][0])),a("span",{staticClass:"date-style"},[a("strong",[t._v(t._s(t.data[1][1]))])])]),a("div",{staticClass:"md-subhead"},[a("strong",[t._v(t._s(t.data[1][2]))])])]),a("md-card-media",[a("img",{attrs:{src:t.data[1][3],alt:t.data[1][4]}})]),a("md-card-content",[a("div",{staticClass:"md-subhead"},[a("strong",[t._v("About the company")])]),t._v(" "+t._s(t.data[1][5])),a("br"),a("br"),a("div",{staticClass:"md-subhead"},[a("strong",[t._v("What I did")])]),a("ul",[a("li",[a("strong",[t._v("Body Design & Safety Structures Intern")]),t._v(": Design, validate, and manage structural body components through their lifecycle ")]),a("ul",[a("li",[t._v(" Implemented part reduction measures on Model S estimated to save $30,000 yearly ")]),a("li",[t._v(" Introduced Model 3 rear tow solution for to meet deflection, homologation, crash, and fascia requirements ")]),a("li",[t._v(" Redesigned rear crash structure on Model 3 to meet durability life requirements while maintaining manufacturability ")]),a("li",[t._v(" Supported Model Y launch by implementing manufacturing changes and developing FT&A (GD&T) for body components with tight timelines ")])])])]),a("md-card-media",[a("img",{attrs:{src:t.data[1][8],alt:t.data[1][9]}})]),a("md-button",{attrs:{href:t.data[1][7],target:"_blank","md-alignment":"left"}},[a("strong",[t._v("Details")])])],1),a("md-card",[a("md-card-header",[a("div",{staticClass:"md-title"},[t._v(" "+t._s(t.data[2][0])),a("span",{staticClass:"date-style"},[a("strong",[t._v(t._s(t.data[2][1]))])])]),a("div",{staticClass:"md-subhead"},[a("strong",[t._v(t._s(t.data[2][2]))])])]),a("md-card-media",[a("img",{attrs:{src:t.data[2][3],alt:t.data[2][4]}})]),a("md-card-content",[a("div",{staticClass:"md-subhead"},[a("strong",[t._v("About the company")])]),t._v(" "+t._s(t.data[2][5])),a("br"),a("br"),a("div",{staticClass:"md-subhead"},[a("strong",[t._v("What I did")])]),a("ul",[a("li",[a("strong",[t._v("Modeling/Visualization Intern")]),t._v(": Coding engineering software to tailor it to customer’s (GM, Apple, Google etc.) needs ")]),a("ul",[a("li",[t._v(" Developed software packages for customers to automate repetitive tasks and interface with data files ")]),a("li",[t._v(" Optimized sorting algorithms for lower runtimes; Reduced automatic file creation runtime by 8x ")]),a("li",[t._v("Generated responsive GUIs for user input and output")])]),a("li",[t._v(" Conducted linear and nonlinear finite element analysis to identify viability of customer’s design ")]),a("li",[t._v(" Contributed to development of Internet of Things (IoT) project which will be brought to trade shows ")])])]),a("md-card-media",[a("video",{attrs:{loop:"",muted:"",playsinline:"",controls:""},domProps:{muted:!0}},[a("source",{attrs:{src:t.data[2][8],alt:t.data[2][9],type:"video/mp4"}})])]),a("md-button",{attrs:{href:t.data[2][7],target:"_blank","md-alignment":"left"}},[a("strong",[t._v("Details")])])],1),a("md-card",[a("md-card-header",[a("div",{staticClass:"md-title"},[t._v(" "+t._s(t.data[3][0])),a("span",{staticClass:"date-style"},[a("strong",[t._v(t._s(t.data[3][1]))])])]),a("div",{staticClass:"md-subhead"},[a("strong",[t._v(t._s(t.data[3][2]))])])]),a("md-card-media",[a("img",{attrs:{src:t.data[3][3],alt:t.data[3][4]}})]),a("md-card-content",[a("div",{staticClass:"md-subhead"},[a("strong",[t._v("About the company")])]),t._v(" "+t._s(t.data[3][5])),a("br"),a("br"),a("div",{staticClass:"md-subhead"},[a("strong",[t._v("What I did")])]),a("ul",[a("li",[a("strong",[t._v("Computer Aided Engineering Intern")]),t._v(": analysis and optimization of spring links, trailing arms, and other suspension parts ")]),a("ul",[a("li",[t._v(" Analyzed suspension components to validate structural integrity in various virtual testing scenarios ")]),a("li",[t._v(" Optimized suspension components resulting in mass reduction of more than 300 grams (8% mass reduction) ")]),a("li",[t._v(" Modified designs for smaller blank sizes and easier manufacturability resulting in cheaper product ")]),a("li",[t._v(" Validated parts with real-world Instron testing for max loading and hydraulic fixtures for fatigue loading ")])])])]),a("md-card-media",[a("video",{attrs:{loop:"",muted:"",playsinline:"",controls:""},domProps:{muted:!0}},[a("source",{attrs:{src:t.data[3][8],alt:t.data[3][9],type:"video/mp4"}})])]),a("md-button",{attrs:{href:t.data[3][7],target:"_blank","md-alignment":"left"}},[a("strong",[t._v("Details")])])],1)],1)])},Vt=[],Ot={name:"resume-experience",components:{},data:function(){return{windowWidth:window.innerWidth,data:[["SpaceX","2020-2021","Development Testing Engineer | Previously: Development Testing Intern","https://vishnurengaraj.github.io/spacex.png","SpaceXLogo","SpaceX designs, manufactures and launches advanced rockets and spacecraft. The company was founded in 2002 to revolutionize space technology, with the ultimate goal of enabling people to live on other planets.","Some accomplishments I've made on the team are:","https://www.spacex.com/"],["Tesla","2019","Body Design Intern","https://vishnurengaraj.github.io/tesla.jpg","Tesla Logo","Tesla was founded in 2003 by a group of engineers who wanted to prove that people didn’t need to compromise to drive electric – that electric vehicles can be better, quicker and more fun to drive than gasoline cars. Today, Tesla builds not only all-electric vehicles but also infinitely scalable clean energy generation and storage products. Tesla believes the faster the world stops relying on fossil fuels and moves towards a zero-emission future, the better..","Some accomplishments I've made on the team are:","https://www.tesla.com/","https://vishnurengaraj.github.io/BIWimg.png","Model 3 Body Structure"],["Altair","2018","Modeling/Visualization Intern","http://www.atgproductions.com/atgclients/emc2017/GES/Exhibitor%20Logos/altair.jpg","Altair Logo","Altair is a leading provider of enterprise-class engineering software enabling innovation, reduced development times, and lower costs through the entire product lifecycle from concept design to in-service operation.","Some accomplishments I've made on the team are:","https://www.altair.com/","https://vishnurengaraj.github.io/image2.mp4","Dynamic Crash Sim Result"],["Iroquois Industries","2017","Computer Aided Engineering Intern","http://www.iroquoisind.com/spanish/images/assembly-base.png","Stamped Parts Iroquois Industries Makes","Iroquois Industries Inc. is a multidisciplinary company with the capability to design, validate, prototype and manufacture fully functional metal components and welded assemblies across four commodities: General Stampings, Chassis, Powertrain and Suspension.","Some accomplishments I've made on the team are:","https://www.iroquoisind.com/","https://vishnurengaraj.github.io/image1.mp4","Car front corner suspension"]]}},mounted:function(){var t=this;window.addEventListener("resize",(function(){t.windowWidth=window.innerWidth}))},methods:{}},Pt=Ot,zt=(a("e5b9"),Object(w["a"])(Pt,Tt,Vt,!1,null,"cbbb9b6a",null)),Gt=zt.exports,Ut={name:"Resume",components:{ResumeAward:Dt,ResumeEdu:Ct,ResumeClub:Wt,ResumeExperience:Gt},data:function(){return{tab:null,items:["Experience","Education","Clubs","Awards"]}},methods:{}},Nt=Ut,Bt=(a("00ea"),a("b0af")),qt=a("71a3"),Ft=a("c671"),Ht=a("fe57"),$t=a("aac8"),Jt=Object(w["a"])(Nt,lt,ct,!1,null,"2d201b58",null),Qt=Jt.exports;y()(Jt,{VCard:Bt["a"],VTab:qt["a"],VTabItem:Ft["a"],VTabs:Ht["a"],VTabsItems:$t["a"]});var Kt={name:"about",components:{Timeline:K,Resume:Qt,Project:dt},data:function(){return{scrolled:!1}},methods:{wheel2home:function(t){t.deltaY<0&&0==this.scrolled&&(this.scrolled=!0,this.$router.push({name:"Title"}))},swipeDownHandler:function(){this.$router.push({name:"Title"})}}},Xt=Kt,Zt=(a("014a"),Object(w["a"])(Xt,B,q,!1,null,"14a53b96",null)),Yt=Zt.exports,te=function(){var t=this,e=t.$createElement,i=t._self._c||e;return i("div",{staticClass:"title"},[i("div",{attrs:{id:"wrapper"}},[i("vue-particles",{attrs:{color:"#587792",particleOpacity:1,particlesNumber:40,shapeType:"circle",particleSize:9,linesColor:"8db1ab",linesWidth:2,lineLinked:!0,lineOpacity:1,linesDistance:170,moveSpeed:.75,hoverEffect:!0,hoverMode:"grab",clickEffect:!0,clickMode:"push"}}),i("div",{attrs:{id:"wrapper"}},[i("div",{attrs:{id:"text"}},[i("div",{attrs:{id:"first"}},[t._v("Vishnu")]),i("div",{attrs:{id:"last"}},[t._v("Rengaraj")]),i("div",{attrs:{id:"subtitle"}},[t._v(t._s(t.whois[0]))])])]),i("div",{style:t.dynamicStyles,attrs:{id:"open-about-text"}},[t._v("learn more")]),i("div",{style:t.dynamicStyles,attrs:{id:"open-about-button"}},[i("img",{attrs:{src:a("5cec")}})])],1),i("div",{attrs:{id:"contents"}},[i("About")],1)])},ee=[],ae=(a("99af"),{name:"title",components:{About:Yt},data:function(){return{scrollPosition:0,windowHeight:window.innerHeight,scrollRatio:1,whois:["Mechanical Engineer","Computer Scientist","Graduate Student","Designer","Stress Analyst","Banana Lover"]}},mounted:function(){var t=this;window.addEventListener("scroll",this.updateScroll),window.addEventListener("resize",(function(){t.windowHeight=window.innerHeight})),window.setInterval((function(){t.pollPerson()}),2700)},methods:{updateScroll:function(){this.scrollPosition=window.scrollY,this.scrollRatio=1-this.scrollPosition/this.windowHeight*3},pollPerson:function(){var t=this.whois.shift();this.whois=this.whois.concat(t)}},computed:{dynamicStyles:function(){return{"--opac":this.scrollRatio}}}}),ie=ae,ne=(a("63fb"),Object(w["a"])(ie,te,ee,!1,null,"d9fe17dc",null)),se=ne.exports;i["default"].use(j["a"]);var oe=[{path:"/home",name:"Home",component:N},{path:"/about",name:"About2Home",meta:{transition:"overlay-down-full"},component:Yt},{path:"/about",name:"Home2About",meta:{transition:"overlay-up-full"},component:Yt},{path:"/",name:"Title",meta:{transition:"overlay-down-full"},component:se},{path:"/resume",name:"Resume2Home",meta:{transition:"overlay-up-full"},component:Qt},{path:"/resume",name:"Home2Resume",meta:{transition:"overlay-down-full"},component:Qt}],re=new j["a"]({routes:oe}),de=re,le=a("f309");i["default"].use(le["a"]);var ce=new le["a"]({});i["default"].use(o.a),i["default"].use(r["a"]),i["default"].use(d["a"]),i["default"].use(l["a"],{theme:"light"}),i["default"].use(u.a),i["default"].use(h.a),i["default"].use(p["default"]),i["default"].config.productionTip=!1,new i["default"]({router:de,vuetify:ce,render:function(t){return t(S)}}).$mount("#app")},"5cec":function(t,e){t.exports="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAQAAABIkb+zAAAA+klEQVR42u3RSQ7CMBAFUdZOzshVcjJm7lVsWAAKzoRwt1RvbbV+ybudJEmSJEmSJEmS0mBP+cmdwr7F/AE4bE+gcACGFvMBjtsSKByfl4YW8zcmvMz/Z8LbfIDTugQKp49LQ4v5KxNG5v8nYTRgccKX+Q3/AM50sy90nJvN357QfH4l4TKdQMel+fz1CWHmr0sINb+ScB1PoOMaav6yhJDzKwk3+rdXPbeQ8+clhJ4/nRB+fiXhTk/PPfz8akKO+ZWELPMXJESdPzMh8vwZCdHnTyRkmF9JyDL/S0Km+SMJ2eZ/JGSc/5KQdf4zIfN8SZIkSZIkSZIU0gPQ3AKVOIhG/wAAAABJRU5ErkJggg=="},"63fb":function(t,e,a){"use strict";var i=a("3823"),n=a.n(i);n.a},8259:function(t,e,a){"use strict";var i=a("f7d0"),n=a.n(i);n.a},8914:function(t,e,a){},9464:function(t,e,a){},"9b19":function(t,e,a){t.exports=a.p+"img/logo.63a7d78d.svg"},aafd:function(t,e,a){"use strict";var i=a("3bb3"),n=a.n(i);n.a},c06c:function(t,e,a){},cbec:function(t,e,a){"use strict";var i=a("49ee"),n=a.n(i);n.a},cd43:function(t,e,a){},d083:function(t,e,a){"use strict";var i=a("c06c"),n=a.n(i);n.a},e426:function(t,e,a){"use strict";var i=a("8914"),n=a.n(i);n.a},e5b9:function(t,e,a){"use strict";var i=a("196f"),n=a.n(i);n.a},ea51:function(t,e,a){"use strict";var i=a("9464"),n=a.n(i);n.a},f7d0:function(t,e,a){}});
//# sourceMappingURL=app.294967bc.js.map
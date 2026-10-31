import{c as t}from"./zap-JJp4xEHd.js";/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const o=[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]],g=t("Check",o);/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const i=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["line",{x1:"22",x2:"18",y1:"12",y2:"12",key:"l9bcsi"}],["line",{x1:"6",x2:"2",y1:"12",y2:"12",key:"13hhkx"}],["line",{x1:"12",x2:"12",y1:"6",y2:"2",key:"10w3f3"}],["line",{x1:"12",x2:"12",y1:"22",y2:"18",key:"15g9kq"}]],_=t("Crosshair",i);/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const a=[["path",{d:"M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z",key:"96xj49"}]],m=t("Flame",a);/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const l=[["polygon",{points:"6 3 20 12 6 21 6 3",key:"1oa8hb"}]],k=t("Play",l),y=[5,10,15,25],n=10,c="myenglish_focus_settings_v1",r="myenglish-focus-settings-changed";function u(){try{const e=JSON.parse(localStorage.getItem(c)||"null");return{minutes:y.includes(e==null?void 0:e.minutes)?e.minutes:n,hideClock:(e==null?void 0:e.hideClock)===!0}}catch{return{minutes:n,hideClock:!1}}}function S(e){const s={...u(),...e};try{localStorage.setItem(c,JSON.stringify(s)),window.dispatchEvent(new CustomEvent(r))}catch{}return s}export{g as C,m as F,k as P,_ as a,y as b,r as c,u as g,S as s};

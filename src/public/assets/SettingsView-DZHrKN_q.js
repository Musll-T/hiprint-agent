import{D as me,E as b,aG as da,r as V,aH as ua,aI as Ee,aJ as ca,aK as Bt,aL as It,aM as _t,aN as ut,L as f,a4 as Le,G as je,V as we,Y as ct,m as X,a1 as Ne,J as Z,aO as fa,aP as ba,K as U,U as Te,s as De,X as va,aQ as pa,N as z,O as pt,M as y,a3 as ot,S as ga,ae as ha,$ as G,H as ma,T as Vt,aR as xa,ac as ya,x as Nt,af as wa,at as Sa,a2 as Ca,aS as Ra,v as Ot,a5 as Ta,ap as Pa,aq as ka,aT as za,az as $a,I as Ba,aU as Ia,aF as _a,aV as Va,o as se,j as Pe,w as g,l as Na,u as a,_ as Ft,c as Ue,b as u,h as le,t as lt,d as ye,a as Oa}from"./index-Dq3TnNJu.js";import{s as Fa,N as We,f as Qe,a as Aa}from"./Space-C_T_MHn6.js";import{B as Be,b as At,u as ft,c as J,r as de,a as gt,X as ht,e as Ye,p as Ze,d as be,g as Fe}from"./Button-B-y_Fy3n.js";import{N as ee,u as Me,a as mt,V as et}from"./Input-WxvPfhkY.js";import{a as L,N as ze}from"./FormItem-JjeF8lCF.js";import{j as Da,k as xt,s as Wa,o as Ea,l as yt,i as La,d as Ua}from"./Spin-NdI7HBSL.js";import{t as ja,N as st,c as Ma}from"./Tag-D463yQp-.js";import{u as Ha}from"./use-message-CJ8uyTkj.js";import{u as Ka}from"./composables-CWfVvcRf.js";import"./context-CuSugIpk.js";const Ga=xt(".v-x-scroll",{overflow:"auto",scrollbarWidth:"none"},[xt("&::-webkit-scrollbar",{width:0,height:0})]),Xa=me({name:"XScroll",props:{disabled:Boolean,onScroll:Function},setup(){const e=V(null);function r(c){!(c.currentTarget.offsetWidth<c.currentTarget.scrollWidth)||c.deltaY===0||(c.currentTarget.scrollLeft+=c.deltaY+c.deltaX,c.preventDefault())}const t=da();return Ga.mount({id:"vueuc/x-scroll",head:!0,anchorMetaName:Da,ssr:t}),Object.assign({selfRef:e,handleWheel:r},{scrollTo(...c){var m;(m=e.value)===null||m===void 0||m.scrollTo(...c)}})},render(){return b("div",{ref:"selfRef",onScroll:this.onScroll,onWheel:this.disabled?void 0:this.handleWheel,class:"v-x-scroll"},this.$slots)}});var Ja=/\s/;function qa(e){for(var r=e.length;r--&&Ja.test(e.charAt(r)););return r}var Qa=/^\s+/;function Ya(e){return e&&e.slice(0,qa(e)+1).replace(Qa,"")}var wt=NaN,Za=/^[-+]0x[0-9a-f]+$/i,en=/^0b[01]+$/i,tn=/^0o[0-7]+$/i,an=parseInt;function St(e){if(typeof e=="number")return e;if(ua(e))return wt;if(Ee(e)){var r=typeof e.valueOf=="function"?e.valueOf():e;e=Ee(r)?r+"":r}if(typeof e!="string")return e===0?e:+e;e=Ya(e);var t=en.test(e);return t||tn.test(e)?an(e.slice(2),t?2:8):Za.test(e)?wt:+e}var tt=function(){return ca.Date.now()},nn="Expected a function",rn=Math.max,on=Math.min;function ln(e,r,t){var v,c,m,h,x,P,k=0,w=!1,O=!1,s=!0;if(typeof e!="function")throw new TypeError(nn);r=St(r)||0,Ee(t)&&(w=!!t.leading,O="maxWait"in t,m=O?rn(St(t.maxWait)||0,r):m,s="trailing"in t?!!t.trailing:s);function n(R){var _=v,C=c;return v=c=void 0,k=R,h=e.apply(C,_),h}function i(R){return k=R,x=setTimeout(D,r),w?n(R):h}function N(R){var _=R-P,C=R-k,$=r-_;return O?on($,m-C):$}function F(R){var _=R-P,C=R-k;return P===void 0||_>=r||_<0||O&&C>=m}function D(){var R=tt();if(F(R))return j(R);x=setTimeout(D,N(R))}function j(R){return x=void 0,s&&v?n(R):(v=c=void 0,h)}function q(){x!==void 0&&clearTimeout(x),k=0,v=P=c=x=void 0}function A(){return x===void 0?h:j(tt())}function I(){var R=tt(),_=F(R);if(v=arguments,c=this,P=R,_){if(x===void 0)return i(P);if(O)return clearTimeout(x),x=setTimeout(D,r),n(P)}return x===void 0&&(x=setTimeout(D,r)),h}return I.cancel=q,I.flush=A,I}var sn="Expected a function";function dn(e,r,t){var v=!0,c=!0;if(typeof e!="function")throw new TypeError(sn);return Ee(t)&&(v="leading"in t?!!t.leading:v,c="trailing"in t?!!t.trailing:c),ln(e,r,{leading:v,maxWait:r,trailing:c})}const bt=me({name:"Add",render(){return b("svg",{width:"512",height:"512",viewBox:"0 0 512 512",fill:"none",xmlns:"http://www.w3.org/2000/svg"},b("path",{d:"M256 112V400M400 256H112",stroke:"currentColor","stroke-width":"32","stroke-linecap":"round","stroke-linejoin":"round"}))}}),un=me({name:"Remove",render(){return b("svg",{xmlns:"http://www.w3.org/2000/svg",viewBox:"0 0 512 512"},b("line",{x1:"400",y1:"256",x2:"112",y2:"256",style:`
        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 32px;
      `}))}}),cn=Bt({name:"DynamicTags",common:ut,peers:{Input:_t,Button:It,Tag:ja,Space:Fa},self(){return{inputWidth:"64px"}}}),fn=f("dynamic-tags",[f("input",{minWidth:"var(--n-input-width)"})]),bn=Object.assign(Object.assign(Object.assign({},we.props),Ma),{size:{type:String,default:"medium"},closable:{type:Boolean,default:!0},defaultValue:{type:Array,default:()=>[]},value:Array,inputClass:String,inputStyle:[String,Object],inputProps:Object,max:Number,tagClass:String,tagStyle:[String,Object],renderTag:Function,onCreate:{type:Function,default:e=>e},"onUpdate:value":[Function,Array],onUpdateValue:[Function,Array],onChange:[Function,Array]}),vn=me({name:"DynamicTags",props:bn,slots:Object,setup(e){const{mergedClsPrefixRef:r,inlineThemeDisabled:t}=je(e),{localeRef:v}=At("DynamicTags"),c=ft(e),{mergedDisabledRef:m}=c,h=V(""),x=V(!1),P=V(!0),k=V(null),w=we("DynamicTags","-dynamic-tags",fn,cn,e,r),O=V(e.defaultValue),s=Z(e,"value"),n=Me(s,O),i=X(()=>v.value.add),N=X(()=>Wa(e.size)),F=X(()=>m.value||!!e.max&&n.value.length>=e.max);function D($){const{onChange:M,"onUpdate:value":W,onUpdateValue:K}=e,{nTriggerFormInput:te,nTriggerFormChange:ve}=c;M&&J(M,$),K&&J(K,$),W&&J(W,$),O.value=$,te(),ve()}function j($){const M=n.value.slice(0);M.splice($,1),D(M)}function q($){switch($.key){case"Enter":A()}}function A($){const M=$??h.value;if(M){const W=n.value.slice(0);W.push(e.onCreate(M)),D(W)}x.value=!1,P.value=!0,h.value=""}function I(){A()}function R(){x.value=!0,Ne(()=>{var $;($=k.value)===null||$===void 0||$.focus(),P.value=!1})}const _=X(()=>{const{self:{inputWidth:$}}=w.value;return{"--n-input-width":$}}),C=t?ct("dynamic-tags",void 0,_,e):void 0;return{mergedClsPrefix:r,inputInstRef:k,localizedAdd:i,inputSize:N,inputValue:h,showInput:x,inputForceFocused:P,mergedValue:n,mergedDisabled:m,triggerDisabled:F,handleInputKeyDown:q,handleAddClick:R,handleInputBlur:I,handleCloseClick:j,handleInputConfirm:A,mergedTheme:w,cssVars:t?void 0:_,themeClass:C==null?void 0:C.themeClass,onRender:C==null?void 0:C.onRender}},render(){const{mergedTheme:e,cssVars:r,mergedClsPrefix:t,onRender:v,renderTag:c}=this;return v==null||v(),b(We,{class:[`${t}-dynamic-tags`,this.themeClass],size:"small",style:r,theme:e.peers.Space,themeOverrides:e.peerOverrides.Space,itemStyle:"display: flex;"},{default:()=>{const{mergedTheme:m,tagClass:h,tagStyle:x,type:P,round:k,size:w,color:O,closable:s,mergedDisabled:n,showInput:i,inputValue:N,inputClass:F,inputStyle:D,inputSize:j,inputForceFocused:q,triggerDisabled:A,handleInputKeyDown:I,handleInputBlur:R,handleAddClick:_,handleCloseClick:C,handleInputConfirm:$,$slots:M}=this;return this.mergedValue.map((W,K)=>c?c(W,K):b(st,{key:K,theme:m.peers.Tag,themeOverrides:m.peerOverrides.Tag,class:h,style:x,type:P,round:k,size:w,color:O,closable:s,disabled:n,onClose:()=>{C(K)}},{default:()=>typeof W=="string"?W:W.label})).concat(i?M.input?M.input({submit:$,deactivate:R}):b(ee,Object.assign({placeholder:"",size:j,style:D,class:F,autosize:!0},this.inputProps,{ref:"inputInstRef",value:N,onUpdateValue:W=>{this.inputValue=W},theme:m.peers.Input,themeOverrides:m.peerOverrides.Input,onKeydown:I,onBlur:R,internalForceFocus:q})):M.trigger?M.trigger({activate:_,disabled:A}):b(Be,{dashed:!0,disabled:A,theme:m.peers.Button,themeOverrides:m.peerOverrides.Button,size:j,onClick:_},{icon:()=>b(Le,{clsPrefix:t},{default:()=>b(bt,null)})}))}})}});function pn(e){const{textColorDisabled:r}=e;return{iconColorDisabled:r}}const gn=Bt({name:"InputNumber",common:ut,peers:{Button:It,Input:_t},self:pn});function hn(e){const{primaryColor:r,opacityDisabled:t,borderRadius:v,textColor3:c}=e;return Object.assign(Object.assign({},fa),{iconColor:c,textColor:"white",loadingColor:r,opacityDisabled:t,railColor:"rgba(0, 0, 0, .14)",railColorActive:r,buttonBoxShadow:"0 1px 4px 0 rgba(0, 0, 0, 0.3), inset 0 0 1px 0 rgba(0, 0, 0, 0.05)",buttonColor:"#FFF",railBorderRadiusSmall:v,railBorderRadiusMedium:v,railBorderRadiusLarge:v,buttonBorderRadiusSmall:v,buttonBorderRadiusMedium:v,buttonBorderRadiusLarge:v,boxShadowFocus:`0 0 0 2px ${ba(r,{alpha:.2})}`})}const mn={common:ut,self:hn},xn=U([f("input-number-suffix",`
 display: inline-block;
 margin-right: 10px;
 `),f("input-number-prefix",`
 display: inline-block;
 margin-left: 10px;
 `)]);function yn(e){return e==null||typeof e=="string"&&e.trim()===""?null:Number(e)}function wn(e){return e.includes(".")&&(/^(-)?\d+.*(\.|0)$/.test(e)||/^-?\d*$/.test(e))||e==="-"||e==="-0"}function at(e){return e==null?!0:!Number.isNaN(e)}function Ct(e,r){return typeof e!="number"?"":r===void 0?String(e):e.toFixed(r)}function nt(e){if(e===null)return null;if(typeof e=="number")return e;{const r=Number(e);return Number.isNaN(r)?null:r}}const Rt=800,Tt=100,Sn=Object.assign(Object.assign({},we.props),{autofocus:Boolean,loading:{type:Boolean,default:void 0},placeholder:String,defaultValue:{type:Number,default:null},value:Number,step:{type:[Number,String],default:1},min:[Number,String],max:[Number,String],size:String,disabled:{type:Boolean,default:void 0},validator:Function,bordered:{type:Boolean,default:void 0},showButton:{type:Boolean,default:!0},buttonPlacement:{type:String,default:"right"},inputProps:Object,readonly:Boolean,clearable:Boolean,keyboard:{type:Object,default:{}},updateValueOnInput:{type:Boolean,default:!0},round:{type:Boolean,default:void 0},parse:Function,format:Function,precision:Number,status:String,"onUpdate:value":[Function,Array],onUpdateValue:[Function,Array],onFocus:[Function,Array],onBlur:[Function,Array],onClear:[Function,Array],onChange:[Function,Array]}),fe=me({name:"InputNumber",props:Sn,slots:Object,setup(e){const{mergedBorderedRef:r,mergedClsPrefixRef:t,mergedRtlRef:v}=je(e),c=we("InputNumber","-input-number",xn,gn,e,t),{localeRef:m}=At("InputNumber"),h=ft(e),{mergedSizeRef:x,mergedDisabledRef:P,mergedStatusRef:k}=h,w=V(null),O=V(null),s=V(null),n=V(e.defaultValue),i=Z(e,"value"),N=Me(i,n),F=V(""),D=d=>{const S=String(d).split(".")[1];return S?S.length:0},j=d=>{const S=[e.min,e.max,e.step,d].map(B=>B===void 0?0:D(B));return Math.max(...S)},q=Te(()=>{const{placeholder:d}=e;return d!==void 0?d:m.value.placeholder}),A=Te(()=>{const d=nt(e.step);return d!==null?d===0?1:Math.abs(d):1}),I=Te(()=>{const d=nt(e.min);return d!==null?d:null}),R=Te(()=>{const d=nt(e.max);return d!==null?d:null}),_=()=>{const{value:d}=N;if(at(d)){const{format:S,precision:B}=e;S?F.value=S(d):d===null||B===void 0||D(d)>B?F.value=Ct(d,void 0):F.value=Ct(d,B)}else F.value=String(d)};_();const C=d=>{const{value:S}=N;if(d===S){_();return}const{"onUpdate:value":B,onUpdateValue:o,onChange:l}=e,{nTriggerFormInput:p,nTriggerFormChange:T}=h;l&&J(l,d),o&&J(o,d),B&&J(B,d),n.value=d,p(),T()},$=({offset:d,doUpdateIfValid:S,fixPrecision:B,isInputing:o})=>{const{value:l}=F;if(o&&wn(l))return!1;const p=(e.parse||yn)(l);if(p===null)return S&&C(null),null;if(at(p)){const T=D(p),{precision:E}=e;if(E!==void 0&&E<T&&!B)return!1;let H=Number.parseFloat((p+d).toFixed(E??j(p)));if(at(H)){const{value:Q}=R,{value:ce}=I;if(Q!==null&&H>Q){if(!S||o)return!1;H=Q}if(ce!==null&&H<ce){if(!S||o)return!1;H=ce}return e.validator&&!e.validator(H)?!1:(S&&C(H),H)}}return!1},M=Te(()=>$({offset:0,doUpdateIfValid:!1,isInputing:!1,fixPrecision:!1})===!1),W=Te(()=>{const{value:d}=N;if(e.validator&&d===null)return!1;const{value:S}=A;return $({offset:-S,doUpdateIfValid:!1,isInputing:!1,fixPrecision:!1})!==!1}),K=Te(()=>{const{value:d}=N;if(e.validator&&d===null)return!1;const{value:S}=A;return $({offset:+S,doUpdateIfValid:!1,isInputing:!1,fixPrecision:!1})!==!1});function te(d){const{onFocus:S}=e,{nTriggerFormFocus:B}=h;S&&J(S,d),B()}function ve(d){var S,B;if(d.target===((S=w.value)===null||S===void 0?void 0:S.wrapperElRef))return;const o=$({offset:0,doUpdateIfValid:!0,isInputing:!1,fixPrecision:!0});if(o!==!1){const T=(B=w.value)===null||B===void 0?void 0:B.inputElRef;T&&(T.value=String(o||"")),N.value===o&&_()}else _();const{onBlur:l}=e,{nTriggerFormBlur:p}=h;l&&J(l,d),p(),Ne(()=>{_()})}function ae(d){const{onClear:S}=e;S&&J(S,d)}function Se(){const{value:d}=K;if(!d){he();return}const{value:S}=N;if(S===null)e.validator||C(Re());else{const{value:B}=A;$({offset:B,doUpdateIfValid:!0,isInputing:!1,fixPrecision:!0})}}function Ce(){const{value:d}=W;if(!d){ie();return}const{value:S}=N;if(S===null)e.validator||C(Re());else{const{value:B}=A;$({offset:-B,doUpdateIfValid:!0,isInputing:!1,fixPrecision:!0})}}const ne=te,ke=ve;function Re(){if(e.validator)return null;const{value:d}=I,{value:S}=R;return d!==null?Math.max(0,d):S!==null?Math.min(0,S):0}function re(d){ae(d),C(null)}function pe(d){var S,B,o;!((S=s.value)===null||S===void 0)&&S.$el.contains(d.target)&&d.preventDefault(),!((B=O.value)===null||B===void 0)&&B.$el.contains(d.target)&&d.preventDefault(),(o=w.value)===null||o===void 0||o.activate()}let ge=null,ue=null,Y=null;function ie(){Y&&(window.clearTimeout(Y),Y=null),ge&&(window.clearInterval(ge),ge=null)}let oe=null;function he(){oe&&(window.clearTimeout(oe),oe=null),ue&&(window.clearInterval(ue),ue=null)}function He(){ie(),Y=window.setTimeout(()=>{ge=window.setInterval(()=>{Ce()},Tt)},Rt),mt("mouseup",document,ie,{once:!0})}function xe(){he(),oe=window.setTimeout(()=>{ue=window.setInterval(()=>{Se()},Tt)},Rt),mt("mouseup",document,he,{once:!0})}const Ke=()=>{ue||Se()},Ge=()=>{ge||Ce()};function Xe(d){var S,B;if(d.key==="Enter"){if(d.target===((S=w.value)===null||S===void 0?void 0:S.wrapperElRef))return;$({offset:0,doUpdateIfValid:!0,isInputing:!1,fixPrecision:!0})!==!1&&((B=w.value)===null||B===void 0||B.deactivate())}else if(d.key==="ArrowUp"){if(!K.value||e.keyboard.ArrowUp===!1)return;d.preventDefault(),$({offset:0,doUpdateIfValid:!0,isInputing:!1,fixPrecision:!0})!==!1&&Se()}else if(d.key==="ArrowDown"){if(!W.value||e.keyboard.ArrowDown===!1)return;d.preventDefault(),$({offset:0,doUpdateIfValid:!0,isInputing:!1,fixPrecision:!0})!==!1&&Ce()}}function Ie(d){F.value=d,e.updateValueOnInput&&!e.format&&!e.parse&&e.precision===void 0&&$({offset:0,doUpdateIfValid:!0,isInputing:!0,fixPrecision:!1})}De(N,()=>{_()});const Je={focus:()=>{var d;return(d=w.value)===null||d===void 0?void 0:d.focus()},blur:()=>{var d;return(d=w.value)===null||d===void 0?void 0:d.blur()},select:()=>{var d;return(d=w.value)===null||d===void 0?void 0:d.select()}},qe=va("InputNumber",v,t);return Object.assign(Object.assign({},Je),{rtlEnabled:qe,inputInstRef:w,minusButtonInstRef:O,addButtonInstRef:s,mergedClsPrefix:t,mergedBordered:r,uncontrolledValue:n,mergedValue:N,mergedPlaceholder:q,displayedValueInvalid:M,mergedSize:x,mergedDisabled:P,displayedValue:F,addable:K,minusable:W,mergedStatus:k,handleFocus:ne,handleBlur:ke,handleClear:re,handleMouseDown:pe,handleAddClick:Ke,handleMinusClick:Ge,handleAddMousedown:xe,handleMinusMousedown:He,handleKeyDown:Xe,handleUpdateDisplayedValue:Ie,mergedTheme:c,inputThemeOverrides:{paddingSmall:"0 8px 0 10px",paddingMedium:"0 8px 0 12px",paddingLarge:"0 8px 0 14px"},buttonThemeOverrides:X(()=>{const{self:{iconColorDisabled:d}}=c.value,[S,B,o,l]=pa(d);return{textColorTextDisabled:`rgb(${S}, ${B}, ${o})`,opacityDisabled:`${l}`}})})},render(){const{mergedClsPrefix:e,$slots:r}=this,t=()=>b(ht,{text:!0,disabled:!this.minusable||this.mergedDisabled||this.readonly,focusable:!1,theme:this.mergedTheme.peers.Button,themeOverrides:this.mergedTheme.peerOverrides.Button,builtinThemeOverrides:this.buttonThemeOverrides,onClick:this.handleMinusClick,onMousedown:this.handleMinusMousedown,ref:"minusButtonInstRef"},{icon:()=>gt(r["minus-icon"],()=>[b(Le,{clsPrefix:e},{default:()=>b(un,null)})])}),v=()=>b(ht,{text:!0,disabled:!this.addable||this.mergedDisabled||this.readonly,focusable:!1,theme:this.mergedTheme.peers.Button,themeOverrides:this.mergedTheme.peerOverrides.Button,builtinThemeOverrides:this.buttonThemeOverrides,onClick:this.handleAddClick,onMousedown:this.handleAddMousedown,ref:"addButtonInstRef"},{icon:()=>gt(r["add-icon"],()=>[b(Le,{clsPrefix:e},{default:()=>b(bt,null)})])});return b("div",{class:[`${e}-input-number`,this.rtlEnabled&&`${e}-input-number--rtl`]},b(ee,{ref:"inputInstRef",autofocus:this.autofocus,status:this.mergedStatus,bordered:this.mergedBordered,loading:this.loading,value:this.displayedValue,onUpdateValue:this.handleUpdateDisplayedValue,theme:this.mergedTheme.peers.Input,themeOverrides:this.mergedTheme.peerOverrides.Input,builtinThemeOverrides:this.inputThemeOverrides,size:this.mergedSize,placeholder:this.mergedPlaceholder,disabled:this.mergedDisabled,readonly:this.readonly,round:this.round,textDecoration:this.displayedValueInvalid?"line-through":void 0,onFocus:this.handleFocus,onBlur:this.handleBlur,onKeydown:this.handleKeyDown,onMousedown:this.handleMouseDown,onClear:this.handleClear,clearable:this.clearable,inputProps:this.inputProps,internalLoadingBeforeSuffix:!0},{prefix:()=>{var c;return this.showButton&&this.buttonPlacement==="both"?[t(),de(r.prefix,m=>m?b("span",{class:`${e}-input-number-prefix`},m):null)]:(c=r.prefix)===null||c===void 0?void 0:c.call(r)},suffix:()=>{var c;return this.showButton?[de(r.suffix,m=>m?b("span",{class:`${e}-input-number-suffix`},m):null),this.buttonPlacement==="right"?t():null,v()]:(c=r.suffix)===null||c===void 0?void 0:c.call(r)}}))}}),Cn=f("switch",`
 height: var(--n-height);
 min-width: var(--n-width);
 vertical-align: middle;
 user-select: none;
 -webkit-user-select: none;
 display: inline-flex;
 outline: none;
 justify-content: center;
 align-items: center;
`,[z("children-placeholder",`
 height: var(--n-rail-height);
 display: flex;
 flex-direction: column;
 overflow: hidden;
 pointer-events: none;
 visibility: hidden;
 `),z("rail-placeholder",`
 display: flex;
 flex-wrap: none;
 `),z("button-placeholder",`
 width: calc(1.75 * var(--n-rail-height));
 height: var(--n-rail-height);
 `),f("base-loading",`
 position: absolute;
 top: 50%;
 left: 50%;
 transform: translateX(-50%) translateY(-50%);
 font-size: calc(var(--n-button-width) - 4px);
 color: var(--n-loading-color);
 transition: color .3s var(--n-bezier);
 `,[pt({left:"50%",top:"50%",originalTransform:"translateX(-50%) translateY(-50%)"})]),z("checked, unchecked",`
 transition: color .3s var(--n-bezier);
 color: var(--n-text-color);
 box-sizing: border-box;
 position: absolute;
 white-space: nowrap;
 top: 0;
 bottom: 0;
 display: flex;
 align-items: center;
 line-height: 1;
 `),z("checked",`
 right: 0;
 padding-right: calc(1.25 * var(--n-rail-height) - var(--n-offset));
 `),z("unchecked",`
 left: 0;
 justify-content: flex-end;
 padding-left: calc(1.25 * var(--n-rail-height) - var(--n-offset));
 `),U("&:focus",[z("rail",`
 box-shadow: var(--n-box-shadow-focus);
 `)]),y("round",[z("rail","border-radius: calc(var(--n-rail-height) / 2);",[z("button","border-radius: calc(var(--n-button-height) / 2);")])]),ot("disabled",[ot("icon",[y("rubber-band",[y("pressed",[z("rail",[z("button","max-width: var(--n-button-width-pressed);")])]),z("rail",[U("&:active",[z("button","max-width: var(--n-button-width-pressed);")])]),y("active",[y("pressed",[z("rail",[z("button","left: calc(100% - var(--n-offset) - var(--n-button-width-pressed));")])]),z("rail",[U("&:active",[z("button","left: calc(100% - var(--n-offset) - var(--n-button-width-pressed));")])])])])])]),y("active",[z("rail",[z("button","left: calc(100% - var(--n-button-width) - var(--n-offset))")])]),z("rail",`
 overflow: hidden;
 height: var(--n-rail-height);
 min-width: var(--n-rail-width);
 border-radius: var(--n-rail-border-radius);
 cursor: pointer;
 position: relative;
 transition:
 opacity .3s var(--n-bezier),
 background .3s var(--n-bezier),
 box-shadow .3s var(--n-bezier);
 background-color: var(--n-rail-color);
 `,[z("button-icon",`
 color: var(--n-icon-color);
 transition: color .3s var(--n-bezier);
 font-size: calc(var(--n-button-height) - 4px);
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 display: flex;
 justify-content: center;
 align-items: center;
 line-height: 1;
 `,[pt()]),z("button",`
 align-items: center; 
 top: var(--n-offset);
 left: var(--n-offset);
 height: var(--n-button-height);
 width: var(--n-button-width-pressed);
 max-width: var(--n-button-width);
 border-radius: var(--n-button-border-radius);
 background-color: var(--n-button-color);
 box-shadow: var(--n-button-box-shadow);
 box-sizing: border-box;
 cursor: inherit;
 content: "";
 position: absolute;
 transition:
 background-color .3s var(--n-bezier),
 left .3s var(--n-bezier),
 opacity .3s var(--n-bezier),
 max-width .3s var(--n-bezier),
 box-shadow .3s var(--n-bezier);
 `)]),y("active",[z("rail","background-color: var(--n-rail-color-active);")]),y("loading",[z("rail",`
 cursor: wait;
 `)]),y("disabled",[z("rail",`
 cursor: not-allowed;
 opacity: .5;
 `)])]),Rn=Object.assign(Object.assign({},we.props),{size:{type:String,default:"medium"},value:{type:[String,Number,Boolean],default:void 0},loading:Boolean,defaultValue:{type:[String,Number,Boolean],default:!1},disabled:{type:Boolean,default:void 0},round:{type:Boolean,default:!0},"onUpdate:value":[Function,Array],onUpdateValue:[Function,Array],checkedValue:{type:[String,Number,Boolean],default:!0},uncheckedValue:{type:[String,Number,Boolean],default:!1},railStyle:Function,rubberBand:{type:Boolean,default:!0},onChange:[Function,Array]});let Ve;const Pt=me({name:"Switch",props:Rn,slots:Object,setup(e){Ve===void 0&&(typeof CSS<"u"?typeof CSS.supports<"u"?Ve=CSS.supports("width","max(1px)"):Ve=!1:Ve=!0);const{mergedClsPrefixRef:r,inlineThemeDisabled:t}=je(e),v=we("Switch","-switch",Cn,mn,e,r),c=ft(e),{mergedSizeRef:m,mergedDisabledRef:h}=c,x=V(e.defaultValue),P=Z(e,"value"),k=Me(P,x),w=X(()=>k.value===e.checkedValue),O=V(!1),s=V(!1),n=X(()=>{const{railStyle:C}=e;if(C)return C({focused:s.value,checked:w.value})});function i(C){const{"onUpdate:value":$,onChange:M,onUpdateValue:W}=e,{nTriggerFormInput:K,nTriggerFormChange:te}=c;$&&J($,C),W&&J(W,C),M&&J(M,C),x.value=C,K(),te()}function N(){const{nTriggerFormFocus:C}=c;C()}function F(){const{nTriggerFormBlur:C}=c;C()}function D(){e.loading||h.value||(k.value!==e.checkedValue?i(e.checkedValue):i(e.uncheckedValue))}function j(){s.value=!0,N()}function q(){s.value=!1,F(),O.value=!1}function A(C){e.loading||h.value||C.key===" "&&(k.value!==e.checkedValue?i(e.checkedValue):i(e.uncheckedValue),O.value=!1)}function I(C){e.loading||h.value||C.key===" "&&(C.preventDefault(),O.value=!0)}const R=X(()=>{const{value:C}=m,{self:{opacityDisabled:$,railColor:M,railColorActive:W,buttonBoxShadow:K,buttonColor:te,boxShadowFocus:ve,loadingColor:ae,textColor:Se,iconColor:Ce,[G("buttonHeight",C)]:ne,[G("buttonWidth",C)]:ke,[G("buttonWidthPressed",C)]:Re,[G("railHeight",C)]:re,[G("railWidth",C)]:pe,[G("railBorderRadius",C)]:ge,[G("buttonBorderRadius",C)]:ue},common:{cubicBezierEaseInOut:Y}}=v.value;let ie,oe,he;return Ve?(ie=`calc((${re} - ${ne}) / 2)`,oe=`max(${re}, ${ne})`,he=`max(${pe}, calc(${pe} + ${ne} - ${re}))`):(ie=Ze((be(re)-be(ne))/2),oe=Ze(Math.max(be(re),be(ne))),he=be(re)>be(ne)?pe:Ze(be(pe)+be(ne)-be(re))),{"--n-bezier":Y,"--n-button-border-radius":ue,"--n-button-box-shadow":K,"--n-button-color":te,"--n-button-width":ke,"--n-button-width-pressed":Re,"--n-button-height":ne,"--n-height":oe,"--n-offset":ie,"--n-opacity-disabled":$,"--n-rail-border-radius":ge,"--n-rail-color":M,"--n-rail-color-active":W,"--n-rail-height":re,"--n-rail-width":pe,"--n-width":he,"--n-box-shadow-focus":ve,"--n-loading-color":ae,"--n-text-color":Se,"--n-icon-color":Ce}}),_=t?ct("switch",X(()=>m.value[0]),R,e):void 0;return{handleClick:D,handleBlur:q,handleFocus:j,handleKeyup:A,handleKeydown:I,mergedRailStyle:n,pressed:O,mergedClsPrefix:r,mergedValue:k,checked:w,mergedDisabled:h,cssVars:t?void 0:R,themeClass:_==null?void 0:_.themeClass,onRender:_==null?void 0:_.onRender}},render(){const{mergedClsPrefix:e,mergedDisabled:r,checked:t,mergedRailStyle:v,onRender:c,$slots:m}=this;c==null||c();const{checked:h,unchecked:x,icon:P,"checked-icon":k,"unchecked-icon":w}=m,O=!(Ye(P)&&Ye(k)&&Ye(w));return b("div",{role:"switch","aria-checked":t,class:[`${e}-switch`,this.themeClass,O&&`${e}-switch--icon`,t&&`${e}-switch--active`,r&&`${e}-switch--disabled`,this.round&&`${e}-switch--round`,this.loading&&`${e}-switch--loading`,this.pressed&&`${e}-switch--pressed`,this.rubberBand&&`${e}-switch--rubber-band`],tabindex:this.mergedDisabled?void 0:0,style:this.cssVars,onClick:this.handleClick,onFocus:this.handleFocus,onBlur:this.handleBlur,onKeyup:this.handleKeyup,onKeydown:this.handleKeydown},b("div",{class:`${e}-switch__rail`,"aria-hidden":"true",style:v},de(h,s=>de(x,n=>s||n?b("div",{"aria-hidden":!0,class:`${e}-switch__children-placeholder`},b("div",{class:`${e}-switch__rail-placeholder`},b("div",{class:`${e}-switch__button-placeholder`}),s),b("div",{class:`${e}-switch__rail-placeholder`},b("div",{class:`${e}-switch__button-placeholder`}),n)):null)),b("div",{class:`${e}-switch__button`},de(P,s=>de(k,n=>de(w,i=>b(ga,null,{default:()=>this.loading?b(ha,{key:"loading",clsPrefix:e,strokeWidth:20}):this.checked&&(n||s)?b("div",{class:`${e}-switch__button-icon`,key:n?"checked-icon":"icon"},n||s):!this.checked&&(i||s)?b("div",{class:`${e}-switch__button-icon`,key:i?"unchecked-icon":"icon"},i||s):null})))),de(h,s=>s&&b("div",{key:"checked",class:`${e}-switch__checked`},s)),de(x,s=>s&&b("div",{key:"unchecked",class:`${e}-switch__unchecked`},s)))))}}),vt=ma("n-tabs"),Dt={tab:[String,Number,Object,Function],name:{type:[String,Number],required:!0},disabled:Boolean,displayDirective:{type:String,default:"if"},closable:{type:Boolean,default:void 0},tabProps:Object,label:[String,Number,Object,Function]},Ae=me({__TAB_PANE__:!0,name:"TabPane",alias:["TabPanel"],props:Dt,slots:Object,setup(e){const r=Vt(vt,null);return r||xa("tab-pane","`n-tab-pane` must be placed inside `n-tabs`."),{style:r.paneStyleRef,class:r.paneClassRef,mergedClsPrefix:r.mergedClsPrefixRef}},render(){return b("div",{class:[`${this.mergedClsPrefix}-tab-pane`,this.class],style:this.style},this.$slots)}}),Tn=Object.assign({internalLeftPadded:Boolean,internalAddable:Boolean,internalCreatedByPane:Boolean},Ca(Dt,["displayDirective"])),dt=me({__TAB__:!0,inheritAttrs:!1,name:"Tab",props:Tn,setup(e){const{mergedClsPrefixRef:r,valueRef:t,typeRef:v,closableRef:c,tabStyleRef:m,addTabStyleRef:h,tabClassRef:x,addTabClassRef:P,tabChangeIdRef:k,onBeforeLeaveRef:w,triggerRef:O,handleAdd:s,activateTab:n,handleClose:i}=Vt(vt);return{trigger:O,mergedClosable:X(()=>{if(e.internalAddable)return!1;const{closable:N}=e;return N===void 0?c.value:N}),style:m,addStyle:h,tabClass:x,addTabClass:P,clsPrefix:r,value:t,type:v,handleClose(N){N.stopPropagation(),!e.disabled&&i(e.name)},activateTab(){if(e.disabled)return;if(e.internalAddable){s();return}const{name:N}=e,F=++k.id;if(N!==t.value){const{value:D}=w;D?Promise.resolve(D(e.name,t.value)).then(j=>{j&&k.id===F&&n(N)}):n(N)}}}},render(){const{internalAddable:e,clsPrefix:r,name:t,disabled:v,label:c,tab:m,value:h,mergedClosable:x,trigger:P,$slots:{default:k}}=this,w=c??m;return b("div",{class:`${r}-tabs-tab-wrapper`},this.internalLeftPadded?b("div",{class:`${r}-tabs-tab-pad`}):null,b("div",Object.assign({key:t,"data-name":t,"data-disabled":v?!0:void 0},ya({class:[`${r}-tabs-tab`,h===t&&`${r}-tabs-tab--active`,v&&`${r}-tabs-tab--disabled`,x&&`${r}-tabs-tab--closable`,e&&`${r}-tabs-tab--addable`,e?this.addTabClass:this.tabClass],onClick:P==="click"?this.activateTab:void 0,onMouseenter:P==="hover"?this.activateTab:void 0,style:e?this.addStyle:this.style},this.internalCreatedByPane?this.tabProps||{}:this.$attrs)),b("span",{class:`${r}-tabs-tab__label`},e?b(Nt,null,b("div",{class:`${r}-tabs-tab__height-placeholder`}," "),b(Le,{clsPrefix:r},{default:()=>b(bt,null)})):k?k():typeof w=="object"?w:wa(w??t)),x&&this.type==="card"?b(Sa,{clsPrefix:r,class:`${r}-tabs-tab__close`,onClick:this.handleClose,disabled:v}):null))}}),Pn=f("tabs",`
 box-sizing: border-box;
 width: 100%;
 display: flex;
 flex-direction: column;
 transition:
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
`,[y("segment-type",[f("tabs-rail",[U("&.transition-disabled",[f("tabs-capsule",`
 transition: none;
 `)])])]),y("top",[f("tab-pane",`
 padding: var(--n-pane-padding-top) var(--n-pane-padding-right) var(--n-pane-padding-bottom) var(--n-pane-padding-left);
 `)]),y("left",[f("tab-pane",`
 padding: var(--n-pane-padding-right) var(--n-pane-padding-bottom) var(--n-pane-padding-left) var(--n-pane-padding-top);
 `)]),y("left, right",`
 flex-direction: row;
 `,[f("tabs-bar",`
 width: 2px;
 right: 0;
 transition:
 top .2s var(--n-bezier),
 max-height .2s var(--n-bezier),
 background-color .3s var(--n-bezier);
 `),f("tabs-tab",`
 padding: var(--n-tab-padding-vertical); 
 `)]),y("right",`
 flex-direction: row-reverse;
 `,[f("tab-pane",`
 padding: var(--n-pane-padding-left) var(--n-pane-padding-top) var(--n-pane-padding-right) var(--n-pane-padding-bottom);
 `),f("tabs-bar",`
 left: 0;
 `)]),y("bottom",`
 flex-direction: column-reverse;
 justify-content: flex-end;
 `,[f("tab-pane",`
 padding: var(--n-pane-padding-bottom) var(--n-pane-padding-right) var(--n-pane-padding-top) var(--n-pane-padding-left);
 `),f("tabs-bar",`
 top: 0;
 `)]),f("tabs-rail",`
 position: relative;
 padding: 3px;
 border-radius: var(--n-tab-border-radius);
 width: 100%;
 background-color: var(--n-color-segment);
 transition: background-color .3s var(--n-bezier);
 display: flex;
 align-items: center;
 `,[f("tabs-capsule",`
 border-radius: var(--n-tab-border-radius);
 position: absolute;
 pointer-events: none;
 background-color: var(--n-tab-color-segment);
 box-shadow: 0 1px 3px 0 rgba(0, 0, 0, .08);
 transition: transform 0.3s var(--n-bezier);
 `),f("tabs-tab-wrapper",`
 flex-basis: 0;
 flex-grow: 1;
 display: flex;
 align-items: center;
 justify-content: center;
 `,[f("tabs-tab",`
 overflow: hidden;
 border-radius: var(--n-tab-border-radius);
 width: 100%;
 display: flex;
 align-items: center;
 justify-content: center;
 `,[y("active",`
 font-weight: var(--n-font-weight-strong);
 color: var(--n-tab-text-color-active);
 `),U("&:hover",`
 color: var(--n-tab-text-color-hover);
 `)])])]),y("flex",[f("tabs-nav",`
 width: 100%;
 position: relative;
 `,[f("tabs-wrapper",`
 width: 100%;
 `,[f("tabs-tab",`
 margin-right: 0;
 `)])])]),f("tabs-nav",`
 box-sizing: border-box;
 line-height: 1.5;
 display: flex;
 transition: border-color .3s var(--n-bezier);
 `,[z("prefix, suffix",`
 display: flex;
 align-items: center;
 `),z("prefix","padding-right: 16px;"),z("suffix","padding-left: 16px;")]),y("top, bottom",[U(">",[f("tabs-nav",[f("tabs-nav-scroll-wrapper",[U("&::before",`
 top: 0;
 bottom: 0;
 left: 0;
 width: 20px;
 `),U("&::after",`
 top: 0;
 bottom: 0;
 right: 0;
 width: 20px;
 `),y("shadow-start",[U("&::before",`
 box-shadow: inset 10px 0 8px -8px rgba(0, 0, 0, .12);
 `)]),y("shadow-end",[U("&::after",`
 box-shadow: inset -10px 0 8px -8px rgba(0, 0, 0, .12);
 `)])])])])]),y("left, right",[f("tabs-nav-scroll-content",`
 flex-direction: column;
 `),U(">",[f("tabs-nav",[f("tabs-nav-scroll-wrapper",[U("&::before",`
 top: 0;
 left: 0;
 right: 0;
 height: 20px;
 `),U("&::after",`
 bottom: 0;
 left: 0;
 right: 0;
 height: 20px;
 `),y("shadow-start",[U("&::before",`
 box-shadow: inset 0 10px 8px -8px rgba(0, 0, 0, .12);
 `)]),y("shadow-end",[U("&::after",`
 box-shadow: inset 0 -10px 8px -8px rgba(0, 0, 0, .12);
 `)])])])])]),f("tabs-nav-scroll-wrapper",`
 flex: 1;
 position: relative;
 overflow: hidden;
 `,[f("tabs-nav-y-scroll",`
 height: 100%;
 width: 100%;
 overflow-y: auto; 
 scrollbar-width: none;
 `,[U("&::-webkit-scrollbar, &::-webkit-scrollbar-track-piece, &::-webkit-scrollbar-thumb",`
 width: 0;
 height: 0;
 display: none;
 `)]),U("&::before, &::after",`
 transition: box-shadow .3s var(--n-bezier);
 pointer-events: none;
 content: "";
 position: absolute;
 z-index: 1;
 `)]),f("tabs-nav-scroll-content",`
 display: flex;
 position: relative;
 min-width: 100%;
 min-height: 100%;
 width: fit-content;
 box-sizing: border-box;
 `),f("tabs-wrapper",`
 display: inline-flex;
 flex-wrap: nowrap;
 position: relative;
 `),f("tabs-tab-wrapper",`
 display: flex;
 flex-wrap: nowrap;
 flex-shrink: 0;
 flex-grow: 0;
 `),f("tabs-tab",`
 cursor: pointer;
 white-space: nowrap;
 flex-wrap: nowrap;
 display: inline-flex;
 align-items: center;
 color: var(--n-tab-text-color);
 font-size: var(--n-tab-font-size);
 background-clip: padding-box;
 padding: var(--n-tab-padding);
 transition:
 box-shadow .3s var(--n-bezier),
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 `,[y("disabled",{cursor:"not-allowed"}),z("close",`
 margin-left: 6px;
 transition:
 background-color .3s var(--n-bezier),
 color .3s var(--n-bezier);
 `),z("label",`
 display: flex;
 align-items: center;
 z-index: 1;
 `)]),f("tabs-bar",`
 position: absolute;
 bottom: 0;
 height: 2px;
 border-radius: 1px;
 background-color: var(--n-bar-color);
 transition:
 left .2s var(--n-bezier),
 max-width .2s var(--n-bezier),
 opacity .3s var(--n-bezier),
 background-color .3s var(--n-bezier);
 `,[U("&.transition-disabled",`
 transition: none;
 `),y("disabled",`
 background-color: var(--n-tab-text-color-disabled)
 `)]),f("tabs-pane-wrapper",`
 position: relative;
 overflow: hidden;
 transition: max-height .2s var(--n-bezier);
 `),f("tab-pane",`
 color: var(--n-pane-text-color);
 width: 100%;
 transition:
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 opacity .2s var(--n-bezier);
 left: 0;
 right: 0;
 top: 0;
 `,[U("&.next-transition-leave-active, &.prev-transition-leave-active, &.next-transition-enter-active, &.prev-transition-enter-active",`
 transition:
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 transform .2s var(--n-bezier),
 opacity .2s var(--n-bezier);
 `),U("&.next-transition-leave-active, &.prev-transition-leave-active",`
 position: absolute;
 `),U("&.next-transition-enter-from, &.prev-transition-leave-to",`
 transform: translateX(32px);
 opacity: 0;
 `),U("&.next-transition-leave-to, &.prev-transition-enter-from",`
 transform: translateX(-32px);
 opacity: 0;
 `),U("&.next-transition-leave-from, &.next-transition-enter-to, &.prev-transition-leave-from, &.prev-transition-enter-to",`
 transform: translateX(0);
 opacity: 1;
 `)]),f("tabs-tab-pad",`
 box-sizing: border-box;
 width: var(--n-tab-gap);
 flex-grow: 0;
 flex-shrink: 0;
 `),y("line-type, bar-type",[f("tabs-tab",`
 font-weight: var(--n-tab-font-weight);
 box-sizing: border-box;
 vertical-align: bottom;
 `,[U("&:hover",{color:"var(--n-tab-text-color-hover)"}),y("active",`
 color: var(--n-tab-text-color-active);
 font-weight: var(--n-tab-font-weight-active);
 `),y("disabled",{color:"var(--n-tab-text-color-disabled)"})])]),f("tabs-nav",[y("line-type",[y("top",[z("prefix, suffix",`
 border-bottom: 1px solid var(--n-tab-border-color);
 `),f("tabs-nav-scroll-content",`
 border-bottom: 1px solid var(--n-tab-border-color);
 `),f("tabs-bar",`
 bottom: -1px;
 `)]),y("left",[z("prefix, suffix",`
 border-right: 1px solid var(--n-tab-border-color);
 `),f("tabs-nav-scroll-content",`
 border-right: 1px solid var(--n-tab-border-color);
 `),f("tabs-bar",`
 right: -1px;
 `)]),y("right",[z("prefix, suffix",`
 border-left: 1px solid var(--n-tab-border-color);
 `),f("tabs-nav-scroll-content",`
 border-left: 1px solid var(--n-tab-border-color);
 `),f("tabs-bar",`
 left: -1px;
 `)]),y("bottom",[z("prefix, suffix",`
 border-top: 1px solid var(--n-tab-border-color);
 `),f("tabs-nav-scroll-content",`
 border-top: 1px solid var(--n-tab-border-color);
 `),f("tabs-bar",`
 top: -1px;
 `)]),z("prefix, suffix",`
 transition: border-color .3s var(--n-bezier);
 `),f("tabs-nav-scroll-content",`
 transition: border-color .3s var(--n-bezier);
 `),f("tabs-bar",`
 border-radius: 0;
 `)]),y("card-type",[z("prefix, suffix",`
 transition: border-color .3s var(--n-bezier);
 `),f("tabs-pad",`
 flex-grow: 1;
 transition: border-color .3s var(--n-bezier);
 `),f("tabs-tab-pad",`
 transition: border-color .3s var(--n-bezier);
 `),f("tabs-tab",`
 font-weight: var(--n-tab-font-weight);
 border: 1px solid var(--n-tab-border-color);
 background-color: var(--n-tab-color);
 box-sizing: border-box;
 position: relative;
 vertical-align: bottom;
 display: flex;
 justify-content: space-between;
 font-size: var(--n-tab-font-size);
 color: var(--n-tab-text-color);
 `,[y("addable",`
 padding-left: 8px;
 padding-right: 8px;
 font-size: 16px;
 justify-content: center;
 `,[z("height-placeholder",`
 width: 0;
 font-size: var(--n-tab-font-size);
 `),ot("disabled",[U("&:hover",`
 color: var(--n-tab-text-color-hover);
 `)])]),y("closable","padding-right: 8px;"),y("active",`
 background-color: #0000;
 font-weight: var(--n-tab-font-weight-active);
 color: var(--n-tab-text-color-active);
 `),y("disabled","color: var(--n-tab-text-color-disabled);")])]),y("left, right",`
 flex-direction: column; 
 `,[z("prefix, suffix",`
 padding: var(--n-tab-padding-vertical);
 `),f("tabs-wrapper",`
 flex-direction: column;
 `),f("tabs-tab-wrapper",`
 flex-direction: column;
 `,[f("tabs-tab-pad",`
 height: var(--n-tab-gap-vertical);
 width: 100%;
 `)])]),y("top",[y("card-type",[f("tabs-scroll-padding","border-bottom: 1px solid var(--n-tab-border-color);"),z("prefix, suffix",`
 border-bottom: 1px solid var(--n-tab-border-color);
 `),f("tabs-tab",`
 border-top-left-radius: var(--n-tab-border-radius);
 border-top-right-radius: var(--n-tab-border-radius);
 `,[y("active",`
 border-bottom: 1px solid #0000;
 `)]),f("tabs-tab-pad",`
 border-bottom: 1px solid var(--n-tab-border-color);
 `),f("tabs-pad",`
 border-bottom: 1px solid var(--n-tab-border-color);
 `)])]),y("left",[y("card-type",[f("tabs-scroll-padding","border-right: 1px solid var(--n-tab-border-color);"),z("prefix, suffix",`
 border-right: 1px solid var(--n-tab-border-color);
 `),f("tabs-tab",`
 border-top-left-radius: var(--n-tab-border-radius);
 border-bottom-left-radius: var(--n-tab-border-radius);
 `,[y("active",`
 border-right: 1px solid #0000;
 `)]),f("tabs-tab-pad",`
 border-right: 1px solid var(--n-tab-border-color);
 `),f("tabs-pad",`
 border-right: 1px solid var(--n-tab-border-color);
 `)])]),y("right",[y("card-type",[f("tabs-scroll-padding","border-left: 1px solid var(--n-tab-border-color);"),z("prefix, suffix",`
 border-left: 1px solid var(--n-tab-border-color);
 `),f("tabs-tab",`
 border-top-right-radius: var(--n-tab-border-radius);
 border-bottom-right-radius: var(--n-tab-border-radius);
 `,[y("active",`
 border-left: 1px solid #0000;
 `)]),f("tabs-tab-pad",`
 border-left: 1px solid var(--n-tab-border-color);
 `),f("tabs-pad",`
 border-left: 1px solid var(--n-tab-border-color);
 `)])]),y("bottom",[y("card-type",[f("tabs-scroll-padding","border-top: 1px solid var(--n-tab-border-color);"),z("prefix, suffix",`
 border-top: 1px solid var(--n-tab-border-color);
 `),f("tabs-tab",`
 border-bottom-left-radius: var(--n-tab-border-radius);
 border-bottom-right-radius: var(--n-tab-border-radius);
 `,[y("active",`
 border-top: 1px solid #0000;
 `)]),f("tabs-tab-pad",`
 border-top: 1px solid var(--n-tab-border-color);
 `),f("tabs-pad",`
 border-top: 1px solid var(--n-tab-border-color);
 `)])])])]),rt=dn,kn=Object.assign(Object.assign({},we.props),{value:[String,Number],defaultValue:[String,Number],trigger:{type:String,default:"click"},type:{type:String,default:"bar"},closable:Boolean,justifyContent:String,size:{type:String,default:"medium"},placement:{type:String,default:"top"},tabStyle:[String,Object],tabClass:String,addTabStyle:[String,Object],addTabClass:String,barWidth:Number,paneClass:String,paneStyle:[String,Object],paneWrapperClass:String,paneWrapperStyle:[String,Object],addable:[Boolean,Object],tabsPadding:{type:Number,default:0},animated:Boolean,onBeforeLeave:Function,onAdd:Function,"onUpdate:value":[Function,Array],onUpdateValue:[Function,Array],onClose:[Function,Array],labelSize:String,activeName:[String,Number],onActiveNameChange:[Function,Array]}),zn=me({name:"Tabs",props:kn,slots:Object,setup(e,{slots:r}){var t,v,c,m;const{mergedClsPrefixRef:h,inlineThemeDisabled:x}=je(e),P=we("Tabs","-tabs",Pn,Ra,e,h),k=V(null),w=V(null),O=V(null),s=V(null),n=V(null),i=V(null),N=V(!0),F=V(!0),D=yt(e,["labelSize","size"]),j=yt(e,["activeName","value"]),q=V((v=(t=j.value)!==null&&t!==void 0?t:e.defaultValue)!==null&&v!==void 0?v:r.default?(m=(c=Qe(r.default())[0])===null||c===void 0?void 0:c.props)===null||m===void 0?void 0:m.name:null),A=Me(j,q),I={id:0},R=X(()=>{if(!(!e.justifyContent||e.type==="card"))return{display:"flex",justifyContent:e.justifyContent}});De(A,()=>{I.id=0,W(),K()});function _(){var o;const{value:l}=A;return l===null?null:(o=k.value)===null||o===void 0?void 0:o.querySelector(`[data-name="${l}"]`)}function C(o){if(e.type==="card")return;const{value:l}=w;if(!l)return;const p=l.style.opacity==="0";if(o){const T=`${h.value}-tabs-bar--disabled`,{barWidth:E,placement:H}=e;if(o.dataset.disabled==="true"?l.classList.add(T):l.classList.remove(T),["top","bottom"].includes(H)){if(M(["top","maxHeight","height"]),typeof E=="number"&&o.offsetWidth>=E){const Q=Math.floor((o.offsetWidth-E)/2)+o.offsetLeft;l.style.left=`${Q}px`,l.style.maxWidth=`${E}px`}else l.style.left=`${o.offsetLeft}px`,l.style.maxWidth=`${o.offsetWidth}px`;l.style.width="8192px",p&&(l.style.transition="none"),l.offsetWidth,p&&(l.style.transition="",l.style.opacity="1")}else{if(M(["left","maxWidth","width"]),typeof E=="number"&&o.offsetHeight>=E){const Q=Math.floor((o.offsetHeight-E)/2)+o.offsetTop;l.style.top=`${Q}px`,l.style.maxHeight=`${E}px`}else l.style.top=`${o.offsetTop}px`,l.style.maxHeight=`${o.offsetHeight}px`;l.style.height="8192px",p&&(l.style.transition="none"),l.offsetHeight,p&&(l.style.transition="",l.style.opacity="1")}}}function $(){if(e.type==="card")return;const{value:o}=w;o&&(o.style.opacity="0")}function M(o){const{value:l}=w;if(l)for(const p of o)l.style[p]=""}function W(){if(e.type==="card")return;const o=_();o?C(o):$()}function K(){var o;const l=(o=n.value)===null||o===void 0?void 0:o.$el;if(!l)return;const p=_();if(!p)return;const{scrollLeft:T,offsetWidth:E}=l,{offsetLeft:H,offsetWidth:Q}=p;T>H?l.scrollTo({top:0,left:H,behavior:"smooth"}):H+Q>T+E&&l.scrollTo({top:0,left:H+Q-E,behavior:"smooth"})}const te=V(null);let ve=0,ae=null;function Se(o){const l=te.value;if(l){ve=o.getBoundingClientRect().height;const p=`${ve}px`,T=()=>{l.style.height=p,l.style.maxHeight=p};ae?(T(),ae(),ae=null):ae=T}}function Ce(o){const l=te.value;if(l){const p=o.getBoundingClientRect().height,T=()=>{document.body.offsetHeight,l.style.maxHeight=`${p}px`,l.style.height=`${Math.max(ve,p)}px`};ae?(ae(),ae=null,T()):ae=T}}function ne(){const o=te.value;if(o){o.style.maxHeight="",o.style.height="";const{paneWrapperStyle:l}=e;if(typeof l=="string")o.style.cssText=l;else if(l){const{maxHeight:p,height:T}=l;p!==void 0&&(o.style.maxHeight=p),T!==void 0&&(o.style.height=T)}}}const ke={value:[]},Re=V("next");function re(o){const l=A.value;let p="next";for(const T of ke.value){if(T===l)break;if(T===o){p="prev";break}}Re.value=p,pe(o)}function pe(o){const{onActiveNameChange:l,onUpdateValue:p,"onUpdate:value":T}=e;l&&J(l,o),p&&J(p,o),T&&J(T,o),q.value=o}function ge(o){const{onClose:l}=e;l&&J(l,o)}function ue(){const{value:o}=w;if(!o)return;const l="transition-disabled";o.classList.add(l),W(),o.classList.remove(l)}const Y=V(null);function ie({transitionDisabled:o}){const l=k.value;if(!l)return;o&&l.classList.add("transition-disabled");const p=_();p&&Y.value&&(Y.value.style.width=`${p.offsetWidth}px`,Y.value.style.height=`${p.offsetHeight}px`,Y.value.style.transform=`translateX(${p.offsetLeft-be(getComputedStyle(l).paddingLeft)}px)`,o&&Y.value.offsetWidth),o&&l.classList.remove("transition-disabled")}De([A],()=>{e.type==="segment"&&Ne(()=>{ie({transitionDisabled:!1})})}),Ot(()=>{e.type==="segment"&&ie({transitionDisabled:!0})});let oe=0;function he(o){var l;if(o.contentRect.width===0&&o.contentRect.height===0||oe===o.contentRect.width)return;oe=o.contentRect.width;const{type:p}=e;if((p==="line"||p==="bar")&&ue(),p!=="segment"){const{placement:T}=e;Ie((T==="top"||T==="bottom"?(l=n.value)===null||l===void 0?void 0:l.$el:i.value)||null)}}const He=rt(he,64);De([()=>e.justifyContent,()=>e.size],()=>{Ne(()=>{const{type:o}=e;(o==="line"||o==="bar")&&ue()})});const xe=V(!1);function Ke(o){var l;const{target:p,contentRect:{width:T,height:E}}=o,H=p.parentElement.parentElement.offsetWidth,Q=p.parentElement.parentElement.offsetHeight,{placement:ce}=e;if(!xe.value)ce==="top"||ce==="bottom"?H<T&&(xe.value=!0):Q<E&&(xe.value=!0);else{const{value:_e}=s;if(!_e)return;ce==="top"||ce==="bottom"?H-T>_e.$el.offsetWidth&&(xe.value=!1):Q-E>_e.$el.offsetHeight&&(xe.value=!1)}Ie(((l=n.value)===null||l===void 0?void 0:l.$el)||null)}const Ge=rt(Ke,64);function Xe(){const{onAdd:o}=e;o&&o(),Ne(()=>{const l=_(),{value:p}=n;!l||!p||p.scrollTo({left:l.offsetLeft,top:0,behavior:"smooth"})})}function Ie(o){if(!o)return;const{placement:l}=e;if(l==="top"||l==="bottom"){const{scrollLeft:p,scrollWidth:T,offsetWidth:E}=o;N.value=p<=0,F.value=p+E>=T}else{const{scrollTop:p,scrollHeight:T,offsetHeight:E}=o;N.value=p<=0,F.value=p+E>=T}}const Je=rt(o=>{Ie(o.target)},64);Ba(vt,{triggerRef:Z(e,"trigger"),tabStyleRef:Z(e,"tabStyle"),tabClassRef:Z(e,"tabClass"),addTabStyleRef:Z(e,"addTabStyle"),addTabClassRef:Z(e,"addTabClass"),paneClassRef:Z(e,"paneClass"),paneStyleRef:Z(e,"paneStyle"),mergedClsPrefixRef:h,typeRef:Z(e,"type"),closableRef:Z(e,"closable"),valueRef:A,tabChangeIdRef:I,onBeforeLeaveRef:Z(e,"onBeforeLeave"),activateTab:re,handleClose:ge,handleAdd:Xe}),Ea(()=>{W(),K()}),Ta(()=>{const{value:o}=O;if(!o)return;const{value:l}=h,p=`${l}-tabs-nav-scroll-wrapper--shadow-start`,T=`${l}-tabs-nav-scroll-wrapper--shadow-end`;N.value?o.classList.remove(p):o.classList.add(p),F.value?o.classList.remove(T):o.classList.add(T)});const qe={syncBarPosition:()=>{W()}},d=()=>{ie({transitionDisabled:!0})},S=X(()=>{const{value:o}=D,{type:l}=e,p={card:"Card",bar:"Bar",line:"Line",segment:"Segment"}[l],T=`${o}${p}`,{self:{barColor:E,closeIconColor:H,closeIconColorHover:Q,closeIconColorPressed:ce,tabColor:_e,tabBorderColor:Et,paneTextColor:Lt,tabFontWeight:Ut,tabBorderRadius:jt,tabFontWeightActive:Mt,colorSegment:Ht,fontWeightStrong:Kt,tabColorSegment:Gt,closeSize:Xt,closeIconSize:Jt,closeColorHover:qt,closeColorPressed:Qt,closeBorderRadius:Yt,[G("panePadding",o)]:Oe,[G("tabPadding",T)]:Zt,[G("tabPaddingVertical",T)]:ea,[G("tabGap",T)]:ta,[G("tabGap",`${T}Vertical`)]:aa,[G("tabTextColor",l)]:na,[G("tabTextColorActive",l)]:ra,[G("tabTextColorHover",l)]:ia,[G("tabTextColorDisabled",l)]:oa,[G("tabFontSize",o)]:la},common:{cubicBezierEaseInOut:sa}}=P.value;return{"--n-bezier":sa,"--n-color-segment":Ht,"--n-bar-color":E,"--n-tab-font-size":la,"--n-tab-text-color":na,"--n-tab-text-color-active":ra,"--n-tab-text-color-disabled":oa,"--n-tab-text-color-hover":ia,"--n-pane-text-color":Lt,"--n-tab-border-color":Et,"--n-tab-border-radius":jt,"--n-close-size":Xt,"--n-close-icon-size":Jt,"--n-close-color-hover":qt,"--n-close-color-pressed":Qt,"--n-close-border-radius":Yt,"--n-close-icon-color":H,"--n-close-icon-color-hover":Q,"--n-close-icon-color-pressed":ce,"--n-tab-color":_e,"--n-tab-font-weight":Ut,"--n-tab-font-weight-active":Mt,"--n-tab-padding":Zt,"--n-tab-padding-vertical":ea,"--n-tab-gap":ta,"--n-tab-gap-vertical":aa,"--n-pane-padding-left":Fe(Oe,"left"),"--n-pane-padding-right":Fe(Oe,"right"),"--n-pane-padding-top":Fe(Oe,"top"),"--n-pane-padding-bottom":Fe(Oe,"bottom"),"--n-font-weight-strong":Kt,"--n-tab-color-segment":Gt}}),B=x?ct("tabs",X(()=>`${D.value[0]}${e.type[0]}`),S,e):void 0;return Object.assign({mergedClsPrefix:h,mergedValue:A,renderedNames:new Set,segmentCapsuleElRef:Y,tabsPaneWrapperRef:te,tabsElRef:k,barElRef:w,addTabInstRef:s,xScrollInstRef:n,scrollWrapperElRef:O,addTabFixed:xe,tabWrapperStyle:R,handleNavResize:He,mergedSize:D,handleScroll:Je,handleTabsResize:Ge,cssVars:x?void 0:S,themeClass:B==null?void 0:B.themeClass,animationDirection:Re,renderNameListRef:ke,yScrollElRef:i,handleSegmentResize:d,onAnimationBeforeLeave:Se,onAnimationEnter:Ce,onAnimationAfterEnter:ne,onRender:B==null?void 0:B.onRender},qe)},render(){const{mergedClsPrefix:e,type:r,placement:t,addTabFixed:v,addable:c,mergedSize:m,renderNameListRef:h,onRender:x,paneWrapperClass:P,paneWrapperStyle:k,$slots:{default:w,prefix:O,suffix:s}}=this;x==null||x();const n=w?Qe(w()).filter(I=>I.type.__TAB_PANE__===!0):[],i=w?Qe(w()).filter(I=>I.type.__TAB__===!0):[],N=!i.length,F=r==="card",D=r==="segment",j=!F&&!D&&this.justifyContent;h.value=[];const q=()=>{const I=b("div",{style:this.tabWrapperStyle,class:`${e}-tabs-wrapper`},j?null:b("div",{class:`${e}-tabs-scroll-padding`,style:t==="top"||t==="bottom"?{width:`${this.tabsPadding}px`}:{height:`${this.tabsPadding}px`}}),N?n.map((R,_)=>(h.value.push(R.props.name),it(b(dt,Object.assign({},R.props,{internalCreatedByPane:!0,internalLeftPadded:_!==0&&(!j||j==="center"||j==="start"||j==="end")}),R.children?{default:R.children.tab}:void 0)))):i.map((R,_)=>(h.value.push(R.props.name),it(_!==0&&!j?$t(R):R))),!v&&c&&F?zt(c,(N?n.length:i.length)!==0):null,j?null:b("div",{class:`${e}-tabs-scroll-padding`,style:{width:`${this.tabsPadding}px`}}));return b("div",{ref:"tabsElRef",class:`${e}-tabs-nav-scroll-content`},F&&c?b(et,{onResize:this.handleTabsResize},{default:()=>I}):I,F?b("div",{class:`${e}-tabs-pad`}):null,F?null:b("div",{ref:"barElRef",class:`${e}-tabs-bar`}))},A=D?"top":t;return b("div",{class:[`${e}-tabs`,this.themeClass,`${e}-tabs--${r}-type`,`${e}-tabs--${m}-size`,j&&`${e}-tabs--flex`,`${e}-tabs--${A}`],style:this.cssVars},b("div",{class:[`${e}-tabs-nav--${r}-type`,`${e}-tabs-nav--${A}`,`${e}-tabs-nav`]},de(O,I=>I&&b("div",{class:`${e}-tabs-nav__prefix`},I)),D?b(et,{onResize:this.handleSegmentResize},{default:()=>b("div",{class:`${e}-tabs-rail`,ref:"tabsElRef"},b("div",{class:`${e}-tabs-capsule`,ref:"segmentCapsuleElRef"},b("div",{class:`${e}-tabs-wrapper`},b("div",{class:`${e}-tabs-tab`}))),N?n.map((I,R)=>(h.value.push(I.props.name),b(dt,Object.assign({},I.props,{internalCreatedByPane:!0,internalLeftPadded:R!==0}),I.children?{default:I.children.tab}:void 0))):i.map((I,R)=>(h.value.push(I.props.name),R===0?I:$t(I))))}):b(et,{onResize:this.handleNavResize},{default:()=>b("div",{class:`${e}-tabs-nav-scroll-wrapper`,ref:"scrollWrapperElRef"},["top","bottom"].includes(A)?b(Xa,{ref:"xScrollInstRef",onScroll:this.handleScroll},{default:q}):b("div",{class:`${e}-tabs-nav-y-scroll`,onScroll:this.handleScroll,ref:"yScrollElRef"},q()))}),v&&c&&F?zt(c,!0):null,de(s,I=>I&&b("div",{class:`${e}-tabs-nav__suffix`},I))),N&&(this.animated&&(A==="top"||A==="bottom")?b("div",{ref:"tabsPaneWrapperRef",style:k,class:[`${e}-tabs-pane-wrapper`,P]},kt(n,this.mergedValue,this.renderedNames,this.onAnimationBeforeLeave,this.onAnimationEnter,this.onAnimationAfterEnter,this.animationDirection)):kt(n,this.mergedValue,this.renderedNames)))}});function kt(e,r,t,v,c,m,h){const x=[];return e.forEach(P=>{const{name:k,displayDirective:w,"display-directive":O}=P.props,s=i=>w===i||O===i,n=r===k;if(P.key!==void 0&&(P.key=k),n||s("show")||s("show:lazy")&&t.has(k)){t.has(k)||t.add(k);const i=!s("if");x.push(i?Pa(P,[[ka,n]]):P)}}),h?b(za,{name:`${h}-transition`,onBeforeLeave:v,onEnter:c,onAfterEnter:m},{default:()=>x}):x}function zt(e,r){return b(dt,{ref:"addTabInstRef",key:"__addable",name:"__addable",internalCreatedByPane:!0,internalAddable:!0,internalLeftPadded:r,disabled:typeof e=="object"&&e.disabled})}function $t(e){const r=$a(e);return r.props?r.props.internalLeftPadded=!0:r.props={internalLeftPadded:!0},r}function it(e){return Array.isArray(e.dynamicProps)?e.dynamicProps.includes("internalLeftPadded")||e.dynamicProps.push("internalLeftPadded"):e.dynamicProps=["internalLeftPadded"],e}const Wt=Ia("config",()=>{const e=V(null),r=V(null),t=V(!1),v=V(!1),c=V({}),m=V([]),h=V({newPassword:"",confirmPassword:""}),x=V(!1);async function P(){if(!t.value){t.value=!0,c.value={};try{const s=await _a("/api/config");s._meta&&(m.value=s._meta.restartRequired||[],delete s._meta),s.cors||(s.cors={origin:"*",methods:["GET","POST"]}),s.admin||(s.admin={username:"",password:""}),s.ipWhitelist||(s.ipWhitelist=[]),e.value=s,r.value=JSON.parse(JSON.stringify(s)),h.value={newPassword:"",confirmPassword:""},x.value=!1}catch(s){throw s}finally{t.value=!1}}}function k(){const s={},n=e.value;if(n.port!==void 0&&n.port!==""){const i=Number(n.port);(!Number.isInteger(i)||i<1024||i>65535)&&(s.port="端口范围 1024-65535")}if(n.adminPort!==void 0&&n.adminPort!==""){const i=Number(n.adminPort);(!Number.isInteger(i)||i<1024||i>65535)&&(s.adminPort="端口范围 1024-65535")}if(n.renderConcurrency!==void 0&&n.renderConcurrency!==""){const i=Number(n.renderConcurrency);(!Number.isInteger(i)||i<1||i>20)&&(s.renderConcurrency="范围 1-20")}if(n.printConcurrency!==void 0&&n.printConcurrency!==""){const i=Number(n.printConcurrency);(!Number.isInteger(i)||i<1||i>20)&&(s.printConcurrency="范围 1-20")}if(n.browserPoolSize!==void 0&&n.browserPoolSize!==""){const i=Number(n.browserPoolSize);(!Number.isInteger(i)||i<1||i>20)&&(s.browserPoolSize="范围 1-20")}if(n.maxQueueSize!==void 0&&n.maxQueueSize!==""){const i=Number(n.maxQueueSize);(!Number.isInteger(i)||i<1||i>1e4)&&(s.maxQueueSize="范围 1-10000")}return x.value&&h.value.newPassword&&(h.value.newPassword.length<6&&(s.newPassword="密码长度至少 6 个字符"),h.value.newPassword!==h.value.confirmPassword&&(s.confirmPassword="两次输入的密码不一致")),c.value=s,Object.keys(s).length===0}async function w(){if(!v.value){v.value=!0;try{const s=JSON.parse(JSON.stringify(e.value));x.value&&h.value.newPassword?(s.admin||(s.admin={}),s.admin.password=h.value.newPassword):s.admin&&delete s.admin.password;const n=await Va("/api/config",s);if(n.config){const i=n.config;i.cors||(i.cors={origin:"*",methods:["GET","POST"]}),i.admin||(i.admin={username:"",password:""}),i.ipWhitelist||(i.ipWhitelist=[]),e.value=i,r.value=JSON.parse(JSON.stringify(i))}return h.value={newPassword:"",confirmPassword:""},x.value=!1,{needRestart:!!n.needRestart}}finally{v.value=!1}}}function O(s){return m.value.includes(s)}return{config:e,original:r,loading:t,saving:v,errors:c,restartRequiredKeys:m,passwordForm:h,showPasswordSection:x,loadConfig:P,validateConfig:k,saveConfig:w,isRestartRequired:O}}),$e={__name:"ConfigGroup",props:{title:{type:String,required:!0}},setup(e){return(r,t)=>(se(),Pe(a(Aa),{title:e.title,size:"small"},{default:g(()=>[Na(r.$slots,"default")]),_:3},8,["title"]))}},$n={class:"password-section"},Bn={key:0,class:"password-fields"},In={__name:"PasswordChange",setup(e){const r=Wt(),t=X(()=>r.passwordForm),v=X(()=>r.errors),c=X(()=>r.showPasswordSection);function m(){r.showPasswordSection=!r.showPasswordSection,r.showPasswordSection||(r.passwordForm.newPassword="",r.passwordForm.confirmPassword="")}return(h,x)=>(se(),Ue("div",$n,[u(a(Be),{text:"",type:"primary",size:"small",onClick:m},{default:g(()=>[le(lt(c.value?"收起密码修改":"修改密码"),1)]),_:1}),c.value?(se(),Ue("div",Bn,[u(a(L),{label:"新密码","validation-status":v.value.newPassword?"error":void 0,feedback:v.value.newPassword},{default:g(()=>[u(a(ee),{value:t.value.newPassword,"onUpdate:value":x[0]||(x[0]=P=>t.value.newPassword=P),type:"password","show-password-on":"click",placeholder:"至少 6 个字符",clearable:""},null,8,["value"])]),_:1},8,["validation-status","feedback"]),u(a(L),{label:"确认密码","validation-status":v.value.confirmPassword?"error":void 0,feedback:v.value.confirmPassword},{default:g(()=>[u(a(ee),{value:t.value.confirmPassword,"onUpdate:value":x[1]||(x[1]=P=>t.value.confirmPassword=P),type:"password","show-password-on":"click",placeholder:"再次输入密码",clearable:""},null,8,["value"])]),_:1},8,["validation-status","feedback"])])):ye("",!0)]))}},_n=Ft(In,[["__scopeId","data-v-1917f784"]]),Vn={class:"settings-view"},Nn={class:"settings-actions"},On={__name:"SettingsView",setup(e){const r={render(){return b(st,{type:"warning",size:"tiny",round:!0,style:"margin-left: 6px; vertical-align: middle;"},()=>"需重启")}},t=Wt(),v=Ha(),c=Ka(),m=V(!1),h=V(!1),x=[{label:"trace",value:"trace"},{label:"debug",value:"debug"},{label:"info",value:"info"},{label:"warn",value:"warn"},{label:"error",value:"error"},{label:"fatal",value:"fatal"}],P=X(()=>!t.config||!t.original?!1:JSON.stringify(t.config)!==JSON.stringify(t.original));function k(){c.warning({title:"确认保存",content:"确认要保存配置更改吗？部分参数修改后需要重启服务才能生效。",positiveText:"保存",negativeText:"取消",onPositiveClick:w})}async function w(){if(!t.validateConfig()){v.error("配置校验未通过，请检查标红的字段");return}try{const s=await t.saveConfig();s&&s.needRestart?v.warning("配置已保存，部分参数需要重启服务才能生效",{duration:5e3}):v.success("配置保存成功")}catch(s){v.error("保存失败: "+(s.message||"未知错误"))}}async function O(){try{await t.loadConfig(),v.info("配置已重置")}catch(s){v.error("加载配置失败: "+(s.message||"未知错误"))}}return Ot(()=>{t.config||t.loadConfig().catch(s=>{v.error("加载配置失败: "+(s.message||"未知错误"))})}),(s,n)=>(se(),Ue("div",Vn,[u(a(La),{show:a(t).loading},{default:g(()=>[a(t).config?(se(),Ue(Nt,{key:0},[u(a(zn),{type:"line",animated:""},{default:g(()=>[u(a(Ae),{name:"basic",tab:"基础服务"},{default:g(()=>[u(a(We),{vertical:"",size:16},{default:g(()=>[u($e,{title:"服务端口"},{default:g(()=>[u(a(ze),{"label-placement":"left","label-width":"140"},{default:g(()=>[u(a(L),{"validation-status":a(t).errors.port?"error":void 0,feedback:a(t).errors.port},{label:g(()=>[n[25]||(n[25]=le(" Socket.IO 端口 ",-1)),a(t).isRestartRequired("port")?(se(),Pe(r,{key:0})):ye("",!0)]),default:g(()=>[u(a(fe),{value:a(t).config.port,"onUpdate:value":n[0]||(n[0]=i=>a(t).config.port=i),min:1024,max:65535,style:{width:"100%"}},null,8,["value"])]),_:1},8,["validation-status","feedback"]),u(a(L),{"validation-status":a(t).errors.adminPort?"error":void 0,feedback:a(t).errors.adminPort},{label:g(()=>[n[26]||(n[26]=le(" Admin Web 端口 ",-1)),a(t).isRestartRequired("adminPort")?(se(),Pe(r,{key:0})):ye("",!0)]),default:g(()=>[u(a(fe),{value:a(t).config.adminPort,"onUpdate:value":n[1]||(n[1]=i=>a(t).config.adminPort=i),min:1024,max:65535,style:{width:"100%"}},null,8,["value"])]),_:1},8,["validation-status","feedback"])]),_:1})]),_:1}),u($e,{title:"认证与安全"},{default:g(()=>[u(a(ze),{"label-placement":"left","label-width":"140"},{default:g(()=>[u(a(L),{label:"Token"},{default:g(()=>[u(a(ee),{value:a(t).config.token,"onUpdate:value":n[3]||(n[3]=i=>a(t).config.token=i),type:m.value?"text":"password",placeholder:"为空则跳过认证",clearable:""},{suffix:g(()=>[u(a(Be),{text:"",size:"tiny",onClick:n[2]||(n[2]=i=>m.value=!m.value)},{default:g(()=>[le(lt(m.value?"隐藏":"显示"),1)]),_:1})]),_:1},8,["value","type"])]),_:1}),u(a(L),{label:"管理员用户名"},{default:g(()=>[u(a(ee),{value:a(t).config.admin.username,"onUpdate:value":n[4]||(n[4]=i=>a(t).config.admin.username=i),placeholder:"管理员用户名",clearable:""},null,8,["value"])]),_:1}),u(a(L),{label:"密码"},{default:g(()=>[u(_n)]),_:1}),u(a(L),{label:"IP 白名单"},{default:g(()=>[u(a(vn),{value:a(t).config.ipWhitelist,"onUpdate:value":n[5]||(n[5]=i=>a(t).config.ipWhitelist=i)},null,8,["value"])]),_:1})]),_:1})]),_:1})]),_:1})]),_:1}),u(a(Ae),{name:"render",tab:"渲染与打印"},{default:g(()=>[u(a(We),{vertical:"",size:16},{default:g(()=>[u($e,{title:"渲染与打印"},{default:g(()=>[u(a(ze),{"label-placement":"left","label-width":"140"},{default:g(()=>[u(a(L),{label:"渲染并发数","validation-status":a(t).errors.renderConcurrency?"error":void 0,feedback:a(t).errors.renderConcurrency},{default:g(()=>[u(a(fe),{value:a(t).config.renderConcurrency,"onUpdate:value":n[6]||(n[6]=i=>a(t).config.renderConcurrency=i),min:1,max:20,style:{width:"100%"}},null,8,["value"])]),_:1},8,["validation-status","feedback"]),u(a(L),{label:"打印并发数","validation-status":a(t).errors.printConcurrency?"error":void 0,feedback:a(t).errors.printConcurrency},{default:g(()=>[u(a(fe),{value:a(t).config.printConcurrency,"onUpdate:value":n[7]||(n[7]=i=>a(t).config.printConcurrency=i),min:1,max:20,style:{width:"100%"}},null,8,["value"])]),_:1},8,["validation-status","feedback"]),u(a(L),{"validation-status":a(t).errors.browserPoolSize?"error":void 0,feedback:a(t).errors.browserPoolSize},{label:g(()=>[n[27]||(n[27]=le(" 浏览器池大小 ",-1)),a(t).isRestartRequired("browserPoolSize")?(se(),Pe(r,{key:0})):ye("",!0)]),default:g(()=>[u(a(fe),{value:a(t).config.browserPoolSize,"onUpdate:value":n[8]||(n[8]=i=>a(t).config.browserPoolSize=i),min:1,max:20,style:{width:"100%"}},null,8,["value"])]),_:1},8,["validation-status","feedback"]),u(a(L),{label:"最大队列","validation-status":a(t).errors.maxQueueSize?"error":void 0,feedback:a(t).errors.maxQueueSize},{default:g(()=>[u(a(fe),{value:a(t).config.maxQueueSize,"onUpdate:value":n[9]||(n[9]=i=>a(t).config.maxQueueSize=i),min:1,max:1e4,style:{width:"100%"}},null,8,["value"])]),_:1},8,["validation-status","feedback"]),u(a(L),{label:"页面复用次数"},{default:g(()=>[u(a(fe),{value:a(t).config.pageReuseLimit,"onUpdate:value":n[10]||(n[10]=i=>a(t).config.pageReuseLimit=i),min:1,style:{width:"100%"}},null,8,["value"])]),_:1})]),_:1})]),_:1}),u($e,{title:"超时设置"},{default:g(()=>[u(a(ze),{"label-placement":"left","label-width":"140"},{default:g(()=>[u(a(L),{label:"渲染超时 (ms)"},{default:g(()=>[u(a(fe),{value:a(t).config.renderTimeout,"onUpdate:value":n[11]||(n[11]=i=>a(t).config.renderTimeout=i),min:1e3,step:1e3,style:{width:"100%"}},null,8,["value"])]),_:1}),u(a(L),{label:"打印超时 (ms)"},{default:g(()=>[u(a(fe),{value:a(t).config.printTimeout,"onUpdate:value":n[12]||(n[12]=i=>a(t).config.printTimeout=i),min:1e3,step:1e3,style:{width:"100%"}},null,8,["value"])]),_:1})]),_:1})]),_:1})]),_:1})]),_:1}),u(a(Ae),{name:"storage",tab:"存储管理"},{default:g(()=>[u($e,{title:"存储"},{default:g(()=>[u(a(ze),{"label-placement":"left","label-width":"140"},{default:g(()=>[u(a(L),null,{label:g(()=>[n[28]||(n[28]=le(" 数据库路径 ",-1)),a(t).isRestartRequired("dbPath")?(se(),Pe(r,{key:0})):ye("",!0)]),default:g(()=>[u(a(ee),{value:a(t).config.dbPath,"onUpdate:value":n[13]||(n[13]=i=>a(t).config.dbPath=i),placeholder:"./data/hiprint.db"},null,8,["value"])]),_:1}),u(a(L),{label:"日志目录"},{default:g(()=>[u(a(ee),{value:a(t).config.logDir,"onUpdate:value":n[14]||(n[14]=i=>a(t).config.logDir=i),placeholder:"./logs"},null,8,["value"])]),_:1}),u(a(L),{label:"PDF 目录"},{default:g(()=>[u(a(ee),{value:a(t).config.pdfDir,"onUpdate:value":n[15]||(n[15]=i=>a(t).config.pdfDir=i),placeholder:"./data/pdf"},null,8,["value"])]),_:1}),u(a(L),{label:"预览目录"},{default:g(()=>[u(a(ee),{value:a(t).config.previewDir,"onUpdate:value":n[16]||(n[16]=i=>a(t).config.previewDir=i),placeholder:"./data/preview"},null,8,["value"])]),_:1}),u(a(L),{label:"日志级别"},{default:g(()=>[u(a(Ua),{value:a(t).config.logLevel,"onUpdate:value":n[17]||(n[17]=i=>a(t).config.logLevel=i),options:x,style:{width:"100%"}},null,8,["value"])]),_:1}),u(a(L),{label:"任务保留天数"},{default:g(()=>[u(a(fe),{value:a(t).config.jobRetentionDays,"onUpdate:value":n[18]||(n[18]=i=>a(t).config.jobRetentionDays=i),min:1,style:{width:"100%"}},null,8,["value"])]),_:1})]),_:1})]),_:1})]),_:1}),u(a(Ae),{name:"transit",tab:"中转服务"},{default:g(()=>[u($e,{title:"中转服务"},{default:g(()=>[u(a(ze),{"label-placement":"left","label-width":"140"},{default:g(()=>[u(a(L),{label:"启用中转"},{default:g(()=>[u(a(Pt),{value:a(t).config.connectTransit,"onUpdate:value":n[19]||(n[19]=i=>a(t).config.connectTransit=i)},null,8,["value"])]),_:1}),u(a(L),{label:"中转地址"},{default:g(()=>[u(a(ee),{value:a(t).config.transitUrl,"onUpdate:value":n[20]||(n[20]=i=>a(t).config.transitUrl=i),placeholder:"http://transit.example.com:17521",disabled:!a(t).config.connectTransit},null,8,["value","disabled"])]),_:1}),u(a(L),{label:"中转 Token"},{default:g(()=>[u(a(ee),{value:a(t).config.transitToken,"onUpdate:value":n[22]||(n[22]=i=>a(t).config.transitToken=i),type:h.value?"text":"password",placeholder:"中转服务认证 Token",disabled:!a(t).config.connectTransit,clearable:""},{suffix:g(()=>[u(a(Be),{text:"",size:"tiny",onClick:n[21]||(n[21]=i=>h.value=!h.value)},{default:g(()=>[le(lt(h.value?"隐藏":"显示"),1)]),_:1})]),_:1},8,["value","type","disabled"])]),_:1}),u(a(L),null,{label:g(()=>[n[29]||(n[29]=le(" 兼容 EIO3 ",-1)),a(t).isRestartRequired("allowEIO3")?(se(),Pe(r,{key:0})):ye("",!0)]),default:g(()=>[u(a(Pt),{value:a(t).config.allowEIO3,"onUpdate:value":n[23]||(n[23]=i=>a(t).config.allowEIO3=i)},null,8,["value"])]),_:1}),u(a(L),{label:"CORS Origin"},{default:g(()=>[u(a(ee),{value:a(t).config.cors.origin,"onUpdate:value":n[24]||(n[24]=i=>a(t).config.cors.origin=i),placeholder:"*"},null,8,["value"])]),_:1})]),_:1})]),_:1})]),_:1})]),_:1}),Oa("div",Nn,[u(a(We),null,{default:g(()=>[P.value?(se(),Pe(a(st),{key:0,type:"warning",size:"small"},{default:g(()=>[...n[30]||(n[30]=[le("已修改",-1)])]),_:1})):ye("",!0),u(a(Be),{type:"primary",loading:a(t).saving,disabled:!P.value&&!a(t).showPasswordSection,onClick:k},{default:g(()=>[...n[31]||(n[31]=[le(" 保存配置 ",-1)])]),_:1},8,["loading","disabled"]),u(a(Be),{onClick:O},{default:g(()=>[...n[32]||(n[32]=[le("重置",-1)])]),_:1})]),_:1})])],64)):ye("",!0)]),_:1},8,["show"])]))}},Kn=Ft(On,[["__scopeId","data-v-438218df"]]);export{Kn as default};

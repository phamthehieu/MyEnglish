let t=0,a=null;function n(s){a=s}const c=()=>t>0;async function e(s){t++;try{return await(a==null?void 0:a.catch(()=>{})),await s()}finally{t--}}export{c as i,n as s,e as w};

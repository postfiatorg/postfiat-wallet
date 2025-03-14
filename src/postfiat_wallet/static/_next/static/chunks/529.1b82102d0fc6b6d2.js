"use strict";(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[529],{849:(t,e,n)=>{n.r(e),n.d(e,{ApiService:()=>r,apiService:()=>h});var c=n(2457);class s{clearAccountCache(t){for(let e of this.cache.keys())(e.includes("/account/".concat(t))||e.includes("/tasks/".concat(t)))&&this.cache.delete(e)}clearAllCache(){this.cache.clear()}get(t){let e=this.cache.get(t);return e?Date.now()-e.timestamp>this.maxAge?(this.cache.delete(t),null):e.data:null}set(t,e){this.cache.set(t,{data:e,timestamp:Date.now()})}constructor(){this.cache=new Map,this.maxAge=3e5}}let o=new s;class i{createAbortController(t){var e;let n=new AbortController;return t&&(this.activeRequests.has(t)||this.activeRequests.set(t,[]),null===(e=this.activeRequests.get(t))||void 0===e||e.push(n)),n}abortRequestsForAddress(t){t&&((this.activeRequests.get(t)||[]).forEach(t=>{try{t.abort()}catch(t){console.error("Error aborting request:",t)}}),this.activeRequests.set(t,[]))}constructor(){this.activeRequests=new Map}}let a=new i;class r{static getInstance(){return r.instance||(r.instance=new r),r.instance}setAuthenticated(t){this.isAuthenticated=t,console.log("API Service: Authentication state set to ".concat(t))}isPublicEndpoint(t){return["/auth/signin","/auth/create","/wallet/generate","/wallet/address","/health","/server/status"].some(e=>t===e||t.startsWith(e))}async get(t){let e=!(arguments.length>1)||void 0===arguments[1]||arguments[1];if(console.trace("API REQUEST ORIGIN: ".concat(t)),!this.isAuthenticated&&!this.isPublicEndpoint(t))throw console.warn("Blocked unauthenticated GET request to ".concat(t)),Error("Authentication required for ".concat(t));let n=this.getCacheKey(t),c=t.match(/\/account\/([^\/]+)\/|\/tasks\/([^\/]+)/),s=c?c[1]||c[2]:null;if(s&&null!==window.ACTIVE_ACCOUNT&&s!==window.ACTIVE_ACCOUNT)throw console.log("Skipping request for inactive account: ".concat(s)),Error("Account inactive");if(e){let e=o.get(n);if(e)return console.log("Using cached data for ".concat(t)),e}let i=a.createAbortController(s);try{r.logAllRequests&&console.log("API Request:",{endpoint:t,stackTrace:Error().stack,timestamp:new Date().toISOString()}),console.log("[API Request] GET ".concat(t));let c=await fetch("".concat(this.basePath).concat(t),{signal:i.signal});if(!c.ok){let t=await c.text();throw Error("API error (".concat(c.status,"): ").concat(t))}let s=await c.json();return e&&o.set(n,s),s}catch(e){throw e instanceof Error&&"AbortError"===e.name||console.error("API request failed for ".concat(t,":"),e),e}}async post(t,e){if(console.trace("API REQUEST ORIGIN: ".concat(t)),console.log("[API Request] POST ".concat(t),e?"(with data)":""),!this.isAuthenticated&&!this.isPublicEndpoint(t))throw console.warn("Blocked unauthenticated POST request to ".concat(t)),Error("Authentication required for ".concat(t));try{let n=await fetch("".concat(this.basePath).concat(t),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:e?JSON.stringify(e):void 0});if(!n.ok){let t=await n.text();throw Error("API error (".concat(n.status,"): ").concat(t))}let c=await n.json();if(t.includes("/account/")||t.includes("/tasks/")){let e=t.match(/\/account\/([^\/]+)\/|\/tasks\/([^\/]+)/);if(e){let t=e[1]||e[2];o.clearAccountCache(t)}}return c}catch(t){throw t instanceof TypeError&&t.message.includes("fetch")&&c.Up.manualCheck(),t}}getCacheKey(t,e){return"".concat(t).concat(e?JSON.stringify(e):"")}clearCache(t){o.clearAccountCache(t),a.abortRequestsForAddress(t)}clearAllCache(){o.clearAllCache()}abortRequestsForAddress(t){a.abortRequestsForAddress(t)}constructor(){this.isAuthenticated=!1,this.basePath="/api",void 0===window.ACTIVE_ACCOUNT&&(window.ACTIVE_ACCOUNT=null),console.log("API Service initialized")}}r.logAllRequests=!0;let h=r.getInstance()},2457:(t,e,n)=>{n.d(e,{Up:()=>i,bE:()=>s});var c=n(849);let s="connection_status_changed";class o{startMonitoring(){let t=arguments.length>0&&void 0!==arguments[0]&&arguments[0];this.intervalId&&this.stopMonitoring(),this._checkServerConnectivity(t),this.intervalId=setInterval(()=>{this._checkServerConnectivity(t)},5e3),console.log("Connection monitoring started (using ".concat(t?"authenticated":"basic"," endpoints)"))}stopMonitoring(){null!==this.intervalId&&(clearInterval(this.intervalId),this.intervalId=null,console.log("Connection monitoring stopped"))}async checkConnection(){try{let t=await c.apiService.get("/health");if(t&&"object"==typeof t&&"status"in t&&"ok"===t.status)return this.isConnected||(this.isConnected=!0,this.dispatchConnectionEvent(!0)),!0;return this.isConnected&&(this.isConnected=!1,this.dispatchConnectionEvent(!1)),!1}catch(t){return console.error("Connection check failed:",t),this.isConnected&&(this.isConnected=!1,this.dispatchConnectionEvent(!1)),!1}}async manualCheck(){try{let t=await this.checkBasicConnectivity();return this.isConnected=t,this.dispatchConnectionEvent(t),t}catch(t){return this.isConnected=!1,this.dispatchConnectionEvent(!1),!1}}dispatchConnectionEvent(t){console.log("Connection status changed: ".concat(t?"connected":"disconnected"));let e=new CustomEvent(s,{detail:{isConnected:t}});window.dispatchEvent(e)}getConnectionStatus(){return this.isConnected}async checkBasicConnectivity(){try{let t=await fetch("/api/health",{method:"GET",headers:{"Content-Type":"application/json"}});if(t.ok){let e=await t.json();return e&&"ok"===e.status}return!1}catch(t){return console.error("Server connectivity check failed:",t),!1}}async _checkServerConnectivity(t){try{let t=await this.checkBasicConnectivity();t!==this.isConnected&&(this.isConnected=t,this.dispatchConnectionEvent(t))}catch(t){console.error("Error in connectivity check:",t),this.isConnected&&(this.isConnected=!1,this.dispatchConnectionEvent(!1))}}constructor(){this.intervalId=null,this.isConnected=!0}}let i=new o}}]);
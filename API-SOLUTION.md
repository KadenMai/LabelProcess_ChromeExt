# Veeqo API Access Solution

## 🚨 **Problem Identified**

The Veeqo API is **completely blocking** requests from browser contexts (including Chrome extensions) with "Failed to fetch" errors. This is a security measure to prevent unauthorized API access.

## 🔧 **Solution: API Proxy on Veeqo Domain**

Since the API blocks external requests, we need to make API calls from within the Veeqo domain context. Here's how:

### **How It Works:**

1. **Content Script Proxy**: Runs on `app.veeqo.com` pages
2. **Same-Origin Requests**: API calls made from Veeqo domain (bypasses restrictions)
3. **Message Passing**: Background script communicates with content script
4. **Automatic Fallback**: Uses proxy when available, falls back to direct calls

### **🚀 Testing Steps:**

#### **Step 1: Test on Veeqo Domain**
1. Open `app.veeqo.com` in your browser
2. Open `test-veeqo-proxy.html` in the same tab (or inject it)
3. Test the "Test Direct API Call" button
4. This should work since it's running from the Veeqo domain

#### **Step 2: Test Extension API Proxy**
1. Make sure you're on a Veeqo page (`app.veeqo.com`)
2. Click the extension icon
3. Enter your API key
4. Click "Test Connection"
5. Should work via the API proxy

#### **Step 3: Verify Proxy is Working**
1. Open browser console (F12)
2. Look for "API Proxy: Testing Veeqo API" messages
3. Check for successful API responses

### **📋 Expected Results:**

- ✅ **On Veeqo Domain**: API calls work perfectly
- ✅ **Extension Popup**: Works when on Veeqo page
- ❌ **Off Veeqo Domain**: API calls fail (expected)

### **🔍 Debugging:**

#### **Check Console Logs:**
```javascript
// Look for these messages:
"Veeqo API Proxy: Running on Veeqo domain"
"API Proxy: Testing Veeqo API with key: Vqt/97d4d3..."
"API Proxy: Response status: 200"
"API Proxy: Success, got data: {...}"
```

#### **Verify Extension is Working:**
1. Go to `chrome://extensions/`
2. Check that extension is enabled
3. Look for any error messages
4. Reload extension if needed

### **🎯 Usage Instructions:**

#### **For Users:**
1. **Open Veeqo**: Go to `app.veeqo.com`
2. **Configure Extension**: Click extension icon, enter API key
3. **Test Connection**: Should work when on Veeqo page
4. **Use USPS Buttons**: Buttons will have access to order data

#### **For Developers:**
1. **API Proxy**: `js/api-proxy.js` handles same-origin requests
2. **Background Script**: `js/background.js` manages communication
3. **Fallback System**: Multiple methods ensure reliability

### **📁 Key Files:**

- `js/api-proxy.js` - Content script that makes API calls from Veeqo domain
- `js/background.js` - Manages API proxy communication
- `test-veeqo-proxy.html` - Test page for API proxy
- `manifest.json` - Includes host permissions and content scripts

### **🔒 Security Notes:**

- API calls only work from Veeqo domain context
- No API key exposure to external domains
- Secure message passing between extension components
- Proper error handling and logging

### **✅ Success Criteria:**

- Extension popup shows "Connection successful" when on Veeqo page
- Console shows successful API proxy messages
- USPS buttons can access order data
- No CORS or "Failed to fetch" errors when on Veeqo domain

The solution works by leveraging the fact that the content script runs in the same origin as the Veeqo application, allowing it to make API calls that would otherwise be blocked by CORS policies.

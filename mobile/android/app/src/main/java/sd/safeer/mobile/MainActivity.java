package sd.safeer.mobile;

import android.app.Activity;
import android.net.ConnectivityManager;
import android.net.Network;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import java.io.ByteArrayInputStream;
import java.util.Locale;

/** Two isolated launchers for the same local web application; never an authority boundary. */
public final class MainActivity extends Activity {
    // Debug: USB loopback. Release: the HTTPS origin passed at build time (see build.gradle).
    private static final String ORIGIN = BuildConfig.ORIGIN;
    private static final Uri ORIGIN_URI = Uri.parse(ORIGIN);
    private WebView web;
    private LinearLayout error;
    private ProgressBar progress;
    private boolean failed;
    private ConnectivityManager connectivity;
    private ConnectivityManager.NetworkCallback networkCallback;
    private int safeTop;

    static boolean allowed(Uri uri) {
        return ORIGIN_URI.getScheme() != null && ORIGIN_URI.getScheme().equals(uri.getScheme())
            && ORIGIN_URI.getEncodedAuthority() != null && ORIGIN_URI.getEncodedAuthority().equals(uri.getEncodedAuthority());
    }

    private String text(String en, String ar) {
        return "ar".equals(Locale.getDefault().getLanguage()) ? ar : en;
    }

    // D60: only signed Safeer release files may leave the app, and they open in the
    // phone's browser so Android's own installer verifies and updates the app.
    static boolean releaseDownload(Uri uri) {
        String path = uri.getPath();
        return "https".equals(uri.getScheme()) && "github.com".equals(uri.getHost())
            && path != null && path.startsWith("/Baballah2240/Safeer/releases/");
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    private void home() { web.loadUrl(ORIGIN + BuildConfig.START_PATH); }

    // Retry keeps the passenger or driver on the page they were using.
    private void retry() {
        String current = web.getUrl();
        if (current != null && allowed(Uri.parse(current))) web.reload(); else home();
    }

    // Full screen: the page fills the camera cutout area and receives its height as
    // the CSS variable --safe-top (no JavaScript bridge; native sets a style only).
    private void shareSafeTop() {
        if (web == null) return;
        int css = Math.round(safeTop / getResources().getDisplayMetrics().density);
        web.evaluateJavascript("document.documentElement.style.setProperty('--safe-top','" + css + "px')", null);
    }

    private void fullscreen() {
        if (android.os.Build.VERSION.SDK_INT >= 28) {
            android.view.WindowManager.LayoutParams attributes = getWindow().getAttributes();
            attributes.layoutInDisplayCutoutMode = android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(attributes);
        }
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            android.view.WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.setSystemBarsBehavior(android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                controller.hide(WindowInsets.Type.systemBars());
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
    }

    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) fullscreen();
    }

    // The shared app requires JavaScript. Only the fixed origin can navigate or
    // load resources, its server sets CSP, and no native JavaScript bridge exists.
    @android.annotation.SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(14,20,39));
        // Hide bars, but keep controls away from cutouts and the visible keyboard.
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                safeTop = bars.top;
                v.setPadding(bars.left,0,bars.right,bars.bottom);
            } else {
                int left=insets.getSystemWindowInsetLeft(),top=insets.getSystemWindowInsetTop(),right=insets.getSystemWindowInsetRight(),bottom=insets.getSystemWindowInsetBottom();
                if (android.os.Build.VERSION.SDK_INT >= 28 && insets.getDisplayCutout() != null) {
                    android.view.DisplayCutout cutout=insets.getDisplayCutout();
                    left=Math.max(left,cutout.getSafeInsetLeft());top=Math.max(top,cutout.getSafeInsetTop());
                    right=Math.max(right,cutout.getSafeInsetRight());bottom=Math.max(bottom,cutout.getSafeInsetBottom());
                }
                safeTop = top;
                v.setPadding(left,0,right,bottom);
            }
            shareSafeTop();
            return insets;
        });
        progress = new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        root.addView(progress,new LinearLayout.LayoutParams(-1,dp(3)));
        FrameLayout content = new FrameLayout(this);
        root.addView(content,new LinearLayout.LayoutParams(-1,0,1));
        web = new WebView(this);
        content.addView(web,new FrameLayout.LayoutParams(-1,-1));
        WebView.setWebContentsDebuggingEnabled(false);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSaveFormData(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        // Server headers decide: pages are no-store, assets are revalidated (304).
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        // Lets the shared page tell which app and version it runs in (update notice).
        settings.setUserAgentString(settings.getUserAgentString() + " SafeerApp/" + BuildConfig.VERSION_CODE + " (" + BuildConfig.FLAVOR + ")");
        CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
        error = new LinearLayout(this);
        error.setOrientation(LinearLayout.VERTICAL);
        error.setGravity(android.view.Gravity.CENTER);
        error.setPadding(dp(28),dp(28),dp(28),dp(28));
        error.setBackgroundColor(Color.rgb(233,236,255));
        TextView message = new TextView(this);
        message.setText(ORIGIN_URI.getScheme().equals("https")
            ? text("Cannot connect to Safeer\n\nCheck your internet connection and retry. Your account and bookings stay on the server.","تعذر الاتصال بسفير\n\nتحقق من اتصال الإنترنت ثم أعد المحاولة. يبقى حسابك وحجوزاتك على الخادم.")
            : text("Connect to Safeer\n\nKeep this computer's Safeer app running and connect this phone by USB. Ask the operator to restore the USB connection, then retry.","الاتصال بسفير\n\nشغّل سفير على الكمبيوتر ووصل الهاتف بكابل USB. اطلب من المسؤول إعادة اتصال USB ثم أعد المحاولة."));
        message.setTextColor(Color.rgb(22,17,14));
        message.setTextSize(18);
        error.addView(message);
        Button retry = new Button(this);
        retry.setText(text("Retry","إعادة المحاولة"));
        retry.setOnClickListener(v -> retry());
        error.addView(retry);
        content.addView(error,new FrameLayout.LayoutParams(-1,-1));
        error.setVisibility(View.GONE);
        web.setWebChromeClient(new WebChromeClient(){
            @Override public void onProgressChanged(WebView view,int value) {
                progress.setProgress(value);
                progress.setVisibility(value==100 ? View.GONE : View.VISIBLE);
            }
        });
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request) {
                Uri target = request.getUrl();
                if (allowed(target)) return false;
                if (releaseDownload(target)) {
                    try { startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW, target)); }
                    catch (android.content.ActivityNotFoundException ignored) { }
                }
                return true;
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request) {
                if (allowed(request.getUrl())) return null;
                return new WebResourceResponse("text/plain","UTF-8",403,"Blocked",java.util.Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));
            }
            @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon) {
                failed=false;error.setVisibility(View.GONE);
            }
            @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError failure) {
                if(request.isForMainFrame()){failed=true;error.setVisibility(View.VISIBLE);}
            }
            @Override public void onReceivedHttpError(WebView view,WebResourceRequest request,WebResourceResponse response) {
                if(request.isForMainFrame() && response.getStatusCode()>=500){failed=true;error.setVisibility(View.VISIBLE);}
            }
            @Override public void onPageFinished(WebView view,String url) { CookieManager.getInstance().flush(); shareSafeTop(); }
            @Override public void doUpdateVisitedHistory(WebView view,String url,boolean reload) { shareSafeTop(); }
        });
        setContentView(root);
        fullscreen();
        if (state == null || web.restoreState(state) == null) home();
        // Reconnect automatically when the phone gets internet back.
        connectivity = getSystemService(ConnectivityManager.class);
        if (connectivity != null) {
            networkCallback = new ConnectivityManager.NetworkCallback() {
                @Override public void onAvailable(Network network) {
                    runOnUiThread(() -> { if (failed && !isFinishing() && !isDestroyed()) retry(); });
                }
            };
            try { connectivity.registerDefaultNetworkCallback(networkCallback); } catch (RuntimeException ignored) { networkCallback = null; }
        }
    }

    @Override protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);
        web.saveState(state);
    }

    @Override protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override protected void onPause() {
        web.onPause();
        CookieManager.getInstance().flush();
        super.onPause();
    }

    @Override public void onBackPressed() {
        if (allowed(Uri.parse(web.getUrl() == null ? "" : web.getUrl()))) {
            // Close the same-origin web drawer before navigating away. No Java
            // interface or credentials are exposed to JavaScript.
            web.evaluateJavascript("(()=>{const d=document.querySelector('dialog[data-app-drawer][open]');if(d&&d.open){d.close();return true;}const m=document.documentElement.dataset.sidebarOpen==='true'&&document.querySelector('[data-sidebar-toggle]');if(m){m.click();return true;}return false;})()", result -> {
                if (!isFinishing() && !isDestroyed() && !"true".equals(result)) navigateBack();
            });
        } else navigateBack();
    }

    private void navigateBack() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        if (connectivity != null && networkCallback != null) { try { connectivity.unregisterNetworkCallback(networkCallback); } catch (RuntimeException ignored) {} }
        web.stopLoading();web.setWebChromeClient(null);web.setWebViewClient(null);
        ((android.view.ViewGroup)web.getParent()).removeView(web);web.destroy();
        super.onDestroy();
    }
}

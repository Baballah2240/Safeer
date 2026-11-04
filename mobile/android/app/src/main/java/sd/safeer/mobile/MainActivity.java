package sd.safeer.mobile;

import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.print.PrintManager;
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
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import java.io.ByteArrayInputStream;
import java.util.Locale;

/** Two isolated launchers for the same local web application; never an authority boundary. */
public final class MainActivity extends Activity {
    private static final String ORIGIN = "http://127.0.0.1:4320";
    private WebView web;
    private LinearLayout error;
    private ProgressBar progress;
    private boolean failed;

    static boolean allowed(Uri uri) {
        return "http".equals(uri.getScheme()) && "127.0.0.1:4320".equals(uri.getEncodedAuthority());
    }

    private String text(String en, String ar) {
        return "ar".equals(Locale.getDefault().getLanguage()) ? ar : en;
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    private void button(LinearLayout bar, int icon, String label, Runnable action) {
        ImageButton button = new ImageButton(this);
        button.setImageResource(icon);
        button.setBackgroundColor(Color.TRANSPARENT);
        button.setContentDescription(label);
        button.setOnClickListener(v -> action.run());
        bar.addView(button, new LinearLayout.LayoutParams(dp(48), dp(48)));
    }

    private void home() { web.loadUrl(ORIGIN + BuildConfig.START_PATH); }

    // The shared app requires JavaScript. Only the fixed origin can navigate or
    // load resources, its server sets CSP, and no native JavaScript bridge exists.
    @android.annotation.SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(22,17,14));
        // Target 35 draws edge-to-edge: preserve system bar/cutout and keyboard insets.
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                v.setPadding(bars.left,bars.top,bars.right,bars.bottom);
            } else v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            return insets;
        });
        LinearLayout bar = new LinearLayout(this);
        bar.setGravity(android.view.Gravity.CENTER_VERTICAL);
        TextView title = new TextView(this);
        title.setText(getString(R.string.app_name));
        title.setTextColor(Color.WHITE);
        title.setTextSize(17);
        title.setPadding(dp(16),0,0,0);
        bar.addView(title,new LinearLayout.LayoutParams(0,dp(48),1));
        button(bar,R.drawable.ic_home,text("Home","الرئيسية"),this::home);
        button(bar,R.drawable.ic_refresh,text("Refresh","تحديث"),() -> web.reload());
        button(bar,R.drawable.ic_print,text("Print / save PDF","طباعة / حفظ PDF"),() -> {
            if (!failed && allowed(Uri.parse(web.getUrl() == null ? "" : web.getUrl()))) {
                PrintManager manager = (PrintManager)getSystemService(PRINT_SERVICE);
                manager.print(getString(R.string.app_name),web.createPrintDocumentAdapter("Safeer"),null);
            }
        });
        root.addView(bar);
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
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
        error = new LinearLayout(this);
        error.setOrientation(LinearLayout.VERTICAL);
        error.setGravity(android.view.Gravity.CENTER);
        error.setPadding(dp(28),dp(28),dp(28),dp(28));
        error.setBackgroundColor(Color.rgb(241,233,224));
        TextView message = new TextView(this);
        message.setText(text("Connect to Safeer\n\nKeep this computer's Safeer app running and connect this phone by USB. Ask the operator to restore the USB connection, then retry.","الاتصال بسفير\n\nشغّل سفير على الكمبيوتر ووصل الهاتف بكابل USB. اطلب من المسؤول إعادة اتصال USB ثم أعد المحاولة."));
        message.setTextColor(Color.rgb(22,17,14));
        message.setTextSize(18);
        error.addView(message);
        Button retry = new Button(this);
        retry.setText(text("Retry","إعادة المحاولة"));
        retry.setOnClickListener(v -> home());
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
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request) { return !allowed(request.getUrl()); }
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
            @Override public void onPageFinished(WebView view,String url) { CookieManager.getInstance().flush(); }
        });
        setContentView(root);
        home();
    }

    @Override public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        web.stopLoading();web.setWebChromeClient(null);web.setWebViewClient(null);
        ((android.view.ViewGroup)web.getParent()).removeView(web);web.destroy();
        super.onDestroy();
    }
}

package de.stxqq.jewel;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.Base64;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Hosts the web player (bundled in assets) and feeds it whatever another app is
 * playing, e.g. the head unit's Bluetooth music from the phone. The page talks
 * back through window.AndroidBridge (play, pause, next, prev, seekTo).
 */
public class MainActivity extends Activity {
    static final String ACTION_USB = "de.stxqq.jewel.USB";
    static final String ACTION_PHONE = "de.stxqq.jewel.PHONE";
    private static final int FILE_REQUEST = 41;
    private static final String START_URL = "https://appassets.androidplatform.net/assets/index.html";

    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Map<String, String> artCache = new HashMap<>();

    private WebView web;
    private boolean pageReady = false;
    private ValueCallback<Uri[]> fileCallback;
    private boolean usbPending = false;
    private boolean phonePending = false;

    private MediaSessionManager sessions;
    private MediaController controller;
    private String lastKey = "";
    private String lastArt = null;

    private final MediaController.Callback controllerCallback = new MediaController.Callback() {
        @Override public void onMetadataChanged(MediaMetadata metadata) { push(); }
        @Override public void onPlaybackStateChanged(PlaybackState state) { push(); }
        @Override public void onSessionDestroyed() { pickController(); }
    };

    private final MediaSessionManager.OnActiveSessionsChangedListener sessionsChanged =
            controllers -> pickController();

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        final WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        web.setBackgroundColor(0xFFF5F6F8);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assets.shouldInterceptRequest(request.getUrl());
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent i = params.createIntent();
                if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                try {
                    startActivityForResult(i, FILE_REQUEST);
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        setContentView(web);
        web.loadUrl(START_URL);

        sessions = (MediaSessionManager) getSystemService(MEDIA_SESSION_SERVICE);
        usbPending = isUsbIntent(getIntent());
        phonePending = isPhoneIntent(getIntent());
        if (android.os.Build.VERSION.SDK_INT >= 31
                && checkSelfPermission("android.permission.BLUETOOTH_CONNECT") != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{"android.permission.BLUETOOTH_CONNECT"}, 42);
        }
    }

    private static boolean isPhoneIntent(Intent i) {
        return i != null && ACTION_PHONE.equals(i.getAction());
    }

    private void announcePhone() {
        if (!phonePending || !pageReady) return;
        phonePending = false;
        js("window.NativeMedia&&NativeMedia.onPhone&&NativeMedia.onPhone()");
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (isUsbIntent(intent)) { usbPending = true; announceUsb(); }
        if (isPhoneIntent(intent)) { phonePending = true; announcePhone(); }
    }

    private static boolean isUsbIntent(Intent i) {
        if (i == null || i.getAction() == null) return false;
        return ACTION_USB.equals(i.getAction()) || "android.hardware.usb.action.USB_DEVICE_ATTACHED".equals(i.getAction());
    }

    private void announceUsb() {
        if (!usbPending || !pageReady) return;
        usbPending = false;
        js("window.NativeMedia&&NativeMedia.onUsb&&NativeMedia.onUsb()");
    }

    private boolean canAutoStart() {
        return android.os.Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(this);
    }

    @Override
    protected void onResume() {
        super.onResume();
        goImmersive();
        attachSessions();
    }

    @Override
    protected void onDestroy() {
        detachSessions();
        io.shutdownNow();
        web.destroy();
        super.onDestroy();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) goImmersive();
    }

    @Override
    public void onBackPressed() {
        // The player is a single screen; keep it open instead of closing on back.
        moveTaskToBack(true);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_REQUEST || fileCallback == null) return;
        Uri[] result = null;
        if (resultCode == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                int n = data.getClipData().getItemCount();
                result = new Uri[n];
                for (int k = 0; k < n; k++) result[k] = data.getClipData().getItemAt(k).getUri();
            } else if (data.getData() != null) {
                result = new Uri[]{data.getData()};
            }
        }
        fileCallback.onReceiveValue(result);
        fileCallback = null;
    }

    @SuppressWarnings("deprecation")
    private void goImmersive() {
        web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }

    /* ---------------- media sessions ---------------- */

    private ComponentName listenerName() {
        return new ComponentName(this, MediaListener.class);
    }

    private boolean hasAccess() {
        String enabled = Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
        return enabled != null && enabled.contains(getPackageName());
    }

    private void attachSessions() {
        boolean ok = hasAccess();
        js("window.NativeMedia&&NativeMedia.onAccess(" + ok + ")");
        if (!ok || sessions == null) return;
        try {
            sessions.removeOnActiveSessionsChangedListener(sessionsChanged);
            sessions.addOnActiveSessionsChangedListener(sessionsChanged, listenerName(), main);
        } catch (SecurityException e) {
            js("window.NativeMedia&&NativeMedia.onAccess(false)");
            return;
        }
        pickController();
    }

    private void detachSessions() {
        if (sessions != null) {
            try { sessions.removeOnActiveSessionsChangedListener(sessionsChanged); } catch (Exception ignored) { }
        }
        if (controller != null) controller.unregisterCallback(controllerCallback);
        controller = null;
    }

    /** Prefer the session that is currently playing; ignore our own app. */
    private void pickController() {
        List<MediaController> list;
        try {
            list = sessions.getActiveSessions(listenerName());
        } catch (SecurityException e) {
            js("window.NativeMedia&&NativeMedia.onAccess(false)");
            return;
        }
        MediaController best = null;
        for (MediaController c : list) {
            if (getPackageName().equals(c.getPackageName())) continue;
            PlaybackState st = c.getPlaybackState();
            if (st != null && st.getState() == PlaybackState.STATE_PLAYING) { best = c; break; }
            if (best == null) best = c;
        }
        if (controller != null && (best == null || !best.getSessionToken().equals(controller.getSessionToken()))) {
            controller.unregisterCallback(controllerCallback);
            controller = null;
        }
        if (best != null && controller == null) {
            controller = best;
            controller.registerCallback(controllerCallback, main);
        }
        push();
    }

    private void push() {
        try {
            JSONObject o = new JSONObject();
            if (controller == null || controller.getMetadata() == null) {
                o.put("title", "Warte auf Musik …");
                o.put("artist", "Spiel etwas auf dem iPhone ab");
                o.put("playing", false);
                send(o);
                return;
            }
            MediaMetadata m = controller.getMetadata();
            PlaybackState st = controller.getPlaybackState();
            String title = text(m, MediaMetadata.METADATA_KEY_TITLE, MediaMetadata.METADATA_KEY_DISPLAY_TITLE);
            String artist = text(m, MediaMetadata.METADATA_KEY_ARTIST, MediaMetadata.METADATA_KEY_ALBUM_ARTIST);
            String album = text(m, MediaMetadata.METADATA_KEY_ALBUM, null);
            o.put("title", title);
            o.put("artist", artist);
            o.put("album", album);
            o.put("duration", Math.max(0, m.getLong(MediaMetadata.METADATA_KEY_DURATION)));
            o.put("app", appLabel(controller.getPackageName()));
            boolean playing = st != null && st.getState() == PlaybackState.STATE_PLAYING;
            o.put("playing", playing);
            if (st != null) {
                long pos = st.getPosition();
                float speed = st.getPlaybackSpeed() == 0 ? 1f : st.getPlaybackSpeed();
                if (playing && st.getLastPositionUpdateTime() > 0) {
                    pos += (long) ((SystemClock.elapsedRealtime() - st.getLastPositionUpdateTime()) * speed);
                }
                o.put("position", Math.max(0, pos));
                o.put("speed", speed);
            }

            String key = title + "|" + artist;
            if (!key.equals(lastKey)) {
                lastKey = key;
                lastArt = null;
                Bitmap bmp = firstBitmap(m);
                if (bmp != null) lastArt = toDataUrl(bmp);
                // Bluetooth covers are often tiny (or missing): fetch the sharp Apple Music one
                if (bmp == null || Math.max(bmp.getWidth(), bmp.getHeight()) < 500) lookUpArtwork(title, artist, key);
            }
            if (lastArt != null) o.put("art", lastArt);
            send(o);
        } catch (Exception ignored) {
        }
    }

    private void send(JSONObject o) {
        js("window.NativeMedia&&NativeMedia.onUpdate(" + o + ")");
    }

    private void js(String code) {
        if (!pageReady) return;
        main.post(() -> web.evaluateJavascript(code, null));
    }

    private static String text(MediaMetadata m, String key, String fallbackKey) {
        CharSequence v = m.getText(key);
        if ((v == null || v.length() == 0) && fallbackKey != null) v = m.getText(fallbackKey);
        return v == null ? "" : v.toString();
    }

    private static Bitmap firstBitmap(MediaMetadata m) {
        Bitmap b = m.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART);
        if (b == null) b = m.getBitmap(MediaMetadata.METADATA_KEY_ART);
        if (b == null) b = m.getBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON);
        return b;
    }

    private String appLabel(String pkg) {
        try {
            PackageManager pm = getPackageManager();
            ApplicationInfo ai = pm.getApplicationInfo(pkg, 0);
            return pm.getApplicationLabel(ai).toString();
        } catch (Exception e) {
            return "";
        }
    }

    private static String toDataUrl(Bitmap src) {
        int max = 1000;
        Bitmap b = src;
        if (src.getWidth() > max || src.getHeight() > max) {
            float k = (float) max / Math.max(src.getWidth(), src.getHeight());
            b = Bitmap.createScaledBitmap(src, Math.round(src.getWidth() * k), Math.round(src.getHeight() * k), true);
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        b.compress(Bitmap.CompressFormat.JPEG, 88, out);
        return "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
    }

    /** Bluetooth often carries no cover, so look it up by artist and title. */
    private void lookUpArtwork(String title, String artist, String key) {
        if (title.isEmpty()) return;
        String cached = artCache.get(key);
        if (cached != null) { lastArt = cached; return; }
        io.execute(() -> {
            try {
                String term = URLEncoder.encode((artist + " " + title).trim(), "UTF-8");
                JSONObject res = new JSONObject(get("https://itunes.apple.com/search?entity=song&limit=1&term=" + term));
                JSONArray r = res.optJSONArray("results");
                if (r == null || r.length() == 0) return;
                String url = r.getJSONObject(0).optString("artworkUrl100", "").replace("100x100bb", "1000x1000bb");
                if (url.isEmpty()) return;
                HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                c.setConnectTimeout(8000);
                c.setReadTimeout(8000);
                Bitmap bmp;
                try (InputStream in = c.getInputStream()) { bmp = BitmapFactory.decodeStream(in); }
                if (bmp == null) return;
                String data = toDataUrl(bmp);
                main.post(() -> {
                    artCache.put(key, data);
                    if (key.equals(lastKey)) { lastArt = data; push(); }
                });
            } catch (Exception ignored) {
            }
        });
    }

    private static String get(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(8000);
        c.setReadTimeout(8000);
        try (InputStream in = c.getInputStream()) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toString("UTF-8");
        }
    }

    /* ---------------- bridge for the page ---------------- */

    private class Bridge {
        @JavascriptInterface public void ready() {
            main.post(() -> {
                pageReady = true;
                attachSessions();
                js("window.NativeMedia&&NativeMedia.onAutoStart&&NativeMedia.onAutoStart(" + canAutoStart() + ")");
                announceUsb();
                announcePhone();
            });
        }
        @JavascriptInterface public void play() {
            main.post(() -> { if (controller != null) controller.getTransportControls().play(); });
        }
        @JavascriptInterface public void pause() {
            main.post(() -> { if (controller != null) controller.getTransportControls().pause(); });
        }
        @JavascriptInterface public void next() {
            main.post(() -> { if (controller != null) controller.getTransportControls().skipToNext(); });
        }
        @JavascriptInterface public void prev() {
            main.post(() -> { if (controller != null) controller.getTransportControls().skipToPrevious(); });
        }
        @JavascriptInterface public void seekTo(long ms) {
            main.post(() -> { if (controller != null) controller.getTransportControls().seekTo(ms); });
        }
        /** Small GET for the lyrics lookup (LRCLIB only); answers via NativeMedia.onHttp. */
        @JavascriptInterface public void httpGet(String id, String url) {
            io.execute(() -> {
                int status = 0;
                String body = "";
                try {
                    URL u = new URL(url);
                    if (!"https".equals(u.getProtocol()) || !"lrclib.net".equals(u.getHost())) throw new SecurityException(url);
                    HttpURLConnection c = (HttpURLConnection) u.openConnection();
                    c.setConnectTimeout(8000);
                    c.setReadTimeout(10000);
                    c.setRequestProperty("User-Agent", "JewelCD/1.3 (https://github.com/Stxqq/Stxqq)");
                    status = c.getResponseCode();
                    InputStream in = status < 400 ? c.getInputStream() : c.getErrorStream();
                    if (in != null) {
                        try (InputStream s = in) {
                            ByteArrayOutputStream out = new ByteArrayOutputStream();
                            byte[] buf = new byte[8192];
                            int n;
                            while ((n = s.read(buf)) > 0) out.write(buf, 0, n);
                            body = out.toString("UTF-8");
                        }
                    }
                } catch (Exception ignored) {
                }
                js("window.NativeMedia&&NativeMedia.onHttp(" + JSONObject.quote(id) + "," + status + "," + JSONObject.quote(body) + ")");
            });
        }
        @JavascriptInterface public void openAutoStart() {
            main.post(() -> {
                try {
                    startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName())));
                } catch (Exception e) {
                    startActivity(new Intent(Settings.ACTION_SETTINGS));
                }
            });
        }
        @JavascriptInterface public void openAccess() {
            main.post(() -> {
                try {
                    startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
                } catch (Exception e) {
                    startActivity(new Intent(Settings.ACTION_SETTINGS));
                }
            });
        }
    }
}

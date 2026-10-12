package de.stxqq.jewel;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Opens the player when a USB stick is mounted. */
public class UsbMountReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Intent open = new Intent(context, MainActivity.class)
                .setAction(MainActivity.ACTION_USB)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        try {
            // Android 10+ only allows this from the background with "display over other apps".
            context.startActivity(open);
        } catch (Exception ignored) {
        }
    }
}
